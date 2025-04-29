// biome-ignore lint/style/useImportType: not supported
import { NewBet as NewBetEvent } from "../generated/BetsMemory/BetsMemory";
import { Bet, Player, Statistics } from "../generated/schema";
import { BetInterface } from "../generated/BetsMemory/BetInterface";
// biome-ignore lint/style/useImportType: not supported
// biome-ignore lint/suspicious/noShadowRestrictedNames: shadowing
import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

const ID: Bytes = Bytes.fromUTF8("initial");

export function handleNewBet(event: NewBetEvent): void {
	const stat = Statistics.load(ID);
	if (stat === null) {
		throw new Error("Statistics not found");
	}
	const contract = BetInterface.bind(event.params.bet);
	const entity = new Bet(event.params.bet);
	entity.bet = event.params.bet;
	entity.player = event.params.player;
	entity.game = event.params.game;
	entity.amount = contract.getAmount();
	entity.result = contract.getResult();
	entity.status = contract.getStatus();

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	let player = Player.load(event.params.player);

	if (player === null) {
		player = new Player(event.params.player);
		player.address = event.params.player;
		player.betsCount = BigInt.fromI32(1);
		stat.totalPlayers = stat.totalPlayers.plus(BigInt.fromI32(1));
		stat.totalBets = stat.totalBets.plus(BigInt.fromI32(1));
		stat.totalVolume = stat.totalVolume.plus(entity.amount);
	} else {
		player.betsCount = player.betsCount.plus(BigInt.fromI32(1));
		stat.totalBets = stat.totalBets.plus(BigInt.fromI32(1));
		stat.totalVolume = stat.totalVolume.plus(entity.amount);
	}

	player.save();
	stat.save();
	entity.save();
}

export function handleOnce(block: ethereum.Block): void {
	const stat = new Statistics(ID);
	stat.totalBets = BigInt.zero();
	stat.totalVolume = BigInt.zero();
	stat.totalPlayers = BigInt.zero();
	stat.save();
}
