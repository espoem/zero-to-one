"""Python stdlib sqlite3 proofs (Modules 01, 02, 05).

Why Python at all: the stdlib module is the most common SQLite binding in interviews and
scripts, it bundles a *different* SQLite build from the Node bindings, and its transaction
handling changed in Python 3.12 (`autocommit`), which is a classic "Then vs now" trap.
"""

import sqlite3
import sys

import pytest

BUNDLED = "3.53.1"  # CPython 3.15.2 (python-build-standalone) as pinned by .mise.toml


def test_bundled_version_differs_from_node_bindings():
    assert sys.version_info[:2] == (3, 15)
    assert sqlite3.sqlite_version == BUNDLED
    con = sqlite3.connect(":memory:")
    assert con.execute("select sqlite_version()").fetchone()[0] == BUNDLED


def test_foreign_keys_off_by_default_in_stock_builds():
    con = sqlite3.connect(":memory:", autocommit=True)
    assert con.execute("pragma foreign_keys").fetchone()[0] == 0
    con.executescript(
        """
        create table parent(id integer primary key);
        create table child(pid integer references parent(id));
        insert into child values (42);  -- dangling reference accepted
        """
    )
    assert con.execute("select count(*) from child").fetchone()[0] == 1
    con.execute("pragma foreign_keys = on")
    with pytest.raises(sqlite3.IntegrityError, match="FOREIGN KEY"):
        con.execute("insert into child values (43)")


def test_dqs_legacy_misfeature_in_stock_builds():
    con = sqlite3.connect(":memory:")
    # Unknown double-quoted identifier silently degrades to a string literal.
    assert con.execute('select "no_such_column"').fetchone()[0] == "no_such_column"


def test_legacy_isolation_level_opens_implicit_transactions(tmp_path):
    """Then: isolation_level='' (the default before autocommit existed) issues an implicit BEGIN
    before DML, so a forgotten commit() leaves a write lock held."""
    path = tmp_path / "legacy.db"
    a = sqlite3.connect(path, timeout=0)  # legacy default: autocommit=LEGACY_TRANSACTION_CONTROL
    assert a.autocommit == sqlite3.LEGACY_TRANSACTION_CONTROL
    a.execute("create table t(x)")
    a.execute("insert into t values (1)")  # implicit BEGIN happened
    assert a.in_transaction
    b = sqlite3.connect(path, timeout=0)
    with pytest.raises(sqlite3.OperationalError, match="locked"):
        b.execute("insert into t values (2)")
    a.commit()
    b.execute("insert into t values (2)")
    b.commit()


def test_autocommit_false_is_pep249_and_true_is_sqlite_native(tmp_path):
    """Now (3.12+): autocommit=False means "always in a transaction" (PEP 249);
    autocommit=True means SQLite's own autocommit, with explicit BEGIN IMMEDIATE when needed."""
    path = tmp_path / "now.db"
    pep = sqlite3.connect(path, autocommit=False)
    assert pep.in_transaction  # a transaction is open immediately
    pep.execute("create table t(x)")
    pep.commit()
    assert pep.in_transaction  # commit() opens the next one
    pep.close()

    native = sqlite3.connect(path, autocommit=True)
    assert not native.in_transaction
    native.execute("begin immediate")
    native.execute("insert into t values (1)")
    native.execute("commit")
    assert native.execute("select count(*) from t").fetchone()[0] == 1


def test_context_manager_commits_but_does_not_close():
    con = sqlite3.connect(":memory:", autocommit=False)
    con.execute("create table t(x unique)")
    with con:
        con.execute("insert into t values (1)")
    with pytest.raises(sqlite3.IntegrityError):
        with con:
            con.execute("insert into t values (2)")
            con.execute("insert into t values (1)")  # UNIQUE violation -> rollback of the whole block
    # The second block rolled back; the connection is still usable.
    assert con.execute("select count(*) from t").fetchone()[0] == 1


def test_type_affinity_versus_strict():
    con = sqlite3.connect(":memory:")
    con.execute("create table loose(n integer)")
    con.execute("insert into loose values ('42'), ('abc')")
    assert con.execute("select typeof(n) from loose order by rowid").fetchall() == [("integer",), ("text",)]
    con.execute("create table tight(n integer) strict")
    with pytest.raises(sqlite3.IntegrityError, match="cannot store TEXT value in INTEGER column"):
        con.execute("insert into tight values ('abc')")
