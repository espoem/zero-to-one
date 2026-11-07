# Terraform & OpenTofu Cheatsheet

## CLI Commands Reference

| Command | Description | Common Flags |
| --- | --- | --- |
| `terraform init` | Initialize working directory, download providers and modules, lock dependencies. | `-upgrade`, `-reconfigure`, `-backend=false` |
| `terraform validate` | Syntax and internal semantic check of configuration files offline. | `-json` |
| `terraform fmt` | Format HCL files to canonical style standard. | `-recursive`, `-check`, `-diff` |
| `terraform plan` | Generate execution DAG and preview changes between desired and observed state. | `-out=tfplan`, `-refresh=false`, `-refresh-only`, `-minimal-refresh`, `-target=...` |
| `terraform apply` | Execute the execution plan against provider APIs. | `tfplan` (saved plan file), `-auto-approve`, `-parallelism=n` |
| `terraform destroy` | Destroy all resources managed by the configuration. | `-auto-approve`, `-target=...` |
| `terraform test` | Execute native `.tftest.hcl` unit/integration test suites. | `-filter=...`, `-verbose` |
| `terraform state` | Inspect and manipulate state (`list`, `show`, `mv`, `rm`, `pull`, `push`). | `-state=...` |
| `terraform import` | Associate existing external infrastructure with a resource address. | `-config=...`, `-generate-config-out=...` |
| `terraform output` | Read output variables from state. | `-json`, `-raw` |

## HCL Types & Expressions

- **Primitives**: `string`, `number`, `bool`.
- **Collections**: `list(<type>)`, `set(<type>)`, `map(<type>)`.
- **Structural**: `object({ name = string, count = number })`, `tuple([string, number])`.
- **Special**: `any`, `null`, `ephemeral`.
- **Splat Expressions**: `var.instances.*.id` (legacy attribute splat) vs `var.instances[*].id` (full splat).
- **Conditional**: `condition ? true_val : false_val`.
- **For Expressions**: `[for k, v in var.map : upper(v) if length(v) > 3]` or `{for k, v in var.map : k => upper(v)}`.

## Meta-Arguments

- `count`: Numeric multiplier for resource duplication (positional index `count.index`). Prefer `for_each` for stable addressing.
- `for_each`: Map or set iterator creating instances keyed by map keys or set values (`each.key`, `each.value`).
- `depends_on`: Explicit dependency declaration for graph ordering when implicit references are absent.
- `provider`: Explicit provider configuration selector (e.g., `provider = aws.eu_west_1`).
- `lifecycle`:
  - `create_before_destroy = true`: Create replacement resource before destroying the old one.
  - `prevent_destroy = true`: Fail apply if resource is targeted for destruction.
  - `ignore_changes = [tags]`: Ignore drift on specified attributes.
  - `replace_triggered_by = [terraform_data.trigger]`: Force replacement when referenced expressions change.
  - `destroy = false` (Terraform 1.16+): Retain resource when block is removed.

## Refactoring Blocks

```hcl
moved {
  from = aws_instance.old
  to   = module.server.aws_instance.this
}

removed {
  from = aws_security_group.legacy
  lifecycle {
    destroy = false
  }
}

import {
  to = aws_instance.web
  id = "i-1234567890abcdef0"
}
```

## Secret & Ephemeral Handling

- `sensitive = true`: Redacts value output in CLI logs.
- `ephemeral { ... }`: Keeps values in memory only, preventing persistence in state files.
- Write-only arguments: Send data to APIs without reading it back into state.

## Policy-as-Code Syntaxes

- **OPA / Rego**: `package terraform.analysis` with `deny [msg] { ... }`.
- **CEL (Common Expression Language)**: `input.resources.all(r, r.type != "aws_security_group" || r.ingress.all(i, i.cidr_blocks != "0.0.0.0/0"))`.
- **Kyverno / Terraform Policy**: Declarative validation rules matching resource attributes.
