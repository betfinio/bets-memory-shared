import { Transfer as TransferEvent } from "../generated/Template/Token";
import { Example } from "../generated/schema";

export function handleTransfer(event: TransferEvent): void {
	let entity = new Example(event.params.from);
	entity.data = event.params.value;
	entity.save();
}