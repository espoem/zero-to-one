// Module 01: Infrastructure as Code and the Terraform Execution Model: DAGs, Providers, and Ecosystem Comparison
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { DependencyGraph, CycleError, type GraphNode } from './lib/terraform-model.ts';

test('DAG builder registers provider, data, and resource nodes', () => {
  const dag = new DependencyGraph();

  const providerNode: GraphNode = {
    id: 'provider.aws',
    type: 'provider',
    address: 'provider["registry.terraform.io/hashicorp/aws"]',
  };
  const vpcNode: GraphNode = {
    id: 'aws_vpc.main',
    type: 'resource',
    address: 'aws_vpc.main',
  };
  const subnetNode: GraphNode = {
    id: 'aws_subnet.app',
    type: 'resource',
    address: 'aws_subnet.app',
  };

  dag.addNode(providerNode);
  dag.addNode(vpcNode);
  dag.addNode(subnetNode);

  // aws_vpc.main depends on provider.aws
  dag.addEdge('aws_vpc.main', 'provider.aws');
  // aws_subnet.app depends on aws_vpc.main and provider.aws
  dag.addEdge('aws_subnet.app', 'aws_vpc.main');
  dag.addEdge('aws_subnet.app', 'provider.aws');

  assert.equal(dag.getAllNodes().length, 3);
  assert.deepEqual(Array.from(dag.getDependencies('aws_subnet.app')).sort(), [
    'aws_vpc.main',
    'provider.aws',
  ]);
  assert.deepEqual(Array.from(dag.getDependents('provider.aws')).sort(), [
    'aws_subnet.app',
    'aws_vpc.main',
  ]);
});

test('topological sort executes dependencies before dependents', () => {
  const dag = new DependencyGraph();

  dag.addNode({ id: 'p', type: 'provider', address: 'provider.aws' });
  dag.addNode({ id: 'v', type: 'resource', address: 'aws_vpc.main' });
  dag.addNode({ id: 's', type: 'resource', address: 'aws_subnet.app' });
  dag.addNode({ id: 'i', type: 'resource', address: 'aws_instance.web' });

  dag.addEdge('v', 'p');
  dag.addEdge('s', 'v');
  dag.addEdge('i', 's');

  const order = dag.topologicalSort();
  assert.deepEqual(order, ['p', 'v', 's', 'i']);
});

test('negative test: cyclic dependency triggers CycleError with accurate cycle path', () => {
  const dag = new DependencyGraph();

  dag.addNode({ id: 'res_a', type: 'resource', address: 'aws_security_group.a' });
  dag.addNode({ id: 'res_b', type: 'resource', address: 'aws_security_group.b' });

  // Cyclic dependency: A depends on B, B depends on A
  dag.addEdge('res_a', 'res_b');
  dag.addEdge('res_b', 'res_a');

  assert.throws(
    () => dag.topologicalSort(),
    (err: unknown) => {
      assert.ok(err instanceof CycleError);
      assert.ok(err.cyclePath.includes('res_a') && err.cyclePath.includes('res_b'));
      return true;
    },
  );
});

test('negative test: multi-step cycle A -> B -> C -> A is detected', () => {
  const dag = new DependencyGraph();

  dag.addNode({ id: 'node_a', type: 'resource', address: 'aws_route.a' });
  dag.addNode({ id: 'node_b', type: 'resource', address: 'aws_route_table.b' });
  dag.addNode({ id: 'node_c', type: 'resource', address: 'aws_internet_gateway.c' });

  dag.addEdge('node_a', 'node_b');
  dag.addEdge('node_b', 'node_c');
  dag.addEdge('node_c', 'node_a');

  assert.throws(
    () => dag.topologicalSort(),
    (err: unknown) => {
      assert.ok(err instanceof CycleError);
      assert.equal(err.cyclePath.length, 4); // [node_a, node_b, node_c, node_a]
      return true;
    },
  );
});

test('transitive reduction eliminates redundant indirect dependency edges', () => {
  const dag = new DependencyGraph();

  // A -> B -> C, and direct edge A -> C
  dag.addNode({ id: 'A', type: 'resource', address: 'aws_instance.app' });
  dag.addNode({ id: 'B', type: 'resource', address: 'aws_subnet.private' });
  dag.addNode({ id: 'C', type: 'resource', address: 'aws_vpc.main' });

  dag.addEdge('A', 'B');
  dag.addEdge('B', 'C');
  dag.addEdge('A', 'C'); // Transitive redundant edge

  const reduced = dag.transitiveReduction();

  // In the reduced graph, A should depend on B, and B on C; edge A -> C should be removed
  assert.equal(reduced.getDependencies('A').has('B'), true);
  assert.equal(reduced.getDependencies('A').has('C'), false);
  assert.equal(reduced.getDependencies('B').has('C'), true);
});

test('targeted apply (-target) identifies skipped dependents and partial graph drift risk', () => {
  const dag = new DependencyGraph();

  dag.addNode({ id: 'vpc', type: 'resource', address: 'aws_vpc.main' });
  dag.addNode({ id: 'subnet', type: 'resource', address: 'aws_subnet.web' });
  dag.addNode({ id: 'route', type: 'resource', address: 'aws_route.igw' });
  dag.addNode({ id: 'instance', type: 'resource', address: 'aws_instance.web' });

  dag.addEdge('subnet', 'vpc');
  dag.addEdge('route', 'vpc');
  dag.addEdge('instance', 'subnet');

  // If operator runs `terraform apply -target=aws_subnet.web`:
  const { subgraph, skippedDependents, driftRiskNodes } = dag.subgraphForTargets(['subnet']);

  // Subgraph must include subnet and its upstream dependency (vpc)
  assert.ok(subgraph.getNode('subnet'));
  assert.ok(subgraph.getNode('vpc'));
  assert.equal(subgraph.getNode('instance'), undefined);
  assert.equal(subgraph.getNode('route'), undefined);

  // Both instance (depends on subnet) and route (depends on vpc) were skipped!
  // This illustrates the exact -target gotcha: changing shared upstream infra leaves unselected siblings and downstream nodes drifted.
  assert.deepEqual(skippedDependents.sort(), ['instance', 'route']);
  assert.deepEqual(driftRiskNodes.sort(), ['instance', 'route']);
});

test('property: topological sort on random DAGs always preserves causal order', () => {
  fc.assert(
    fc.property(fc.integer({ min: 3, max: 15 }), (nodeCount) => {
      const dag = new DependencyGraph();
      for (let i = 0; i < nodeCount; i++) {
        dag.addNode({ id: `n_${i}`, type: 'resource', address: `res.${i}` });
      }

      // Add random forward edges (i > j: i depends on j) to guarantee acyclicity
      for (let i = 1; i < nodeCount; i++) {
        for (let j = 0; j < i; j++) {
          if ((i * 31 + j * 17) % 3 === 0) {
            dag.addEdge(`n_${i}`, `n_${j}`);
          }
        }
      }

      const order = dag.topologicalSort();
      const posMap = new Map<string, number>();
      order.forEach((id, idx) => posMap.set(id, idx));

      // In the execution order, if A depends on B, B MUST appear before A
      for (let i = 0; i < nodeCount; i++) {
        const id = `n_${i}`;
        const deps = dag.getDependencies(id);
        const myPos = posMap.get(id)!;
        for (const dep of deps) {
          const depPos = posMap.get(dep)!;
          assert.ok(
            depPos < myPos,
            `Dependency ${dep} (pos ${depPos}) must precede dependent ${id} (pos ${myPos})`,
          );
        }
      }
    }),
  );
});
