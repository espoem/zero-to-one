interface Order {
  id: number;
}

export function charge(o: Order): never {
  throw new Error(`card declined for order ${o.id}`);
}
charge({ id: 7 });
