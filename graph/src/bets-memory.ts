// biome-ignore lint/style/useImportType: not supported
import { NewBet as NewBetEvent } from "../generated/BetsMemory/BetsMemory";
import { Bet, Player, Statistics } from "../generated/schema";
import { BetInterface } from "../generated/BetsMemory/BetInterface";
// biome-ignore lint/style/useImportType: not supported
// biome-ignore lint/suspicious/noShadowRestrictedNames: shadowing
import { Address, BigInt, Bytes, dataSource, ethereum } from "@graphprotocol/graph-ts";
import { TimeFrameBetsMemoryStatistics } from "../generated/schema";
import { Pass } from "../generated/BetsMemory/Pass";

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


function getIntervalTimestamp(timestamp: BigInt, interval: string): BigInt {
	const hour = 60 * 60;
	const day = 24 * hour;
	const week = 7 * day;

	if (interval == "hour") {
		return BigInt.fromI32(timestamp.toI32() / hour * hour);
	} else if (interval == "day") {
		return BigInt.fromI32(timestamp.toI32() / day * day);
	} else if (interval == "week") {
		return BigInt.fromI32(timestamp.toI32() / week * week);
	}
	return timestamp; // Default to raw timestamp if no match
}
const passAddress = Address.fromBytes(dataSource.context().getBytes("pass"));
const pass = Pass.bind(passAddress);

function savePlayersStatistics(block: ethereum.Block, interval: string): void {
	// Determine the start of the time interval (e.g., 1:00, 2:00, etc.)
	const intervalStart = getIntervalTimestamp(block.timestamp, interval);
	const id = intervalStart.toHex() + "-" + interval;  // Unique ID based on interval start and type
	let statisticsEntity = TimeFrameBetsMemoryStatistics.load(id);
	const stat = Statistics.load(ID);

	if (statisticsEntity == null) {
		// If no entity exists for this interval, create a new one
		statisticsEntity = new TimeFrameBetsMemoryStatistics(id);
		statisticsEntity.totalPlayers = BigInt.fromI32(0);
		statisticsEntity.totalMembers = BigInt.fromI32(0);
		statisticsEntity.timestamp = intervalStart;
		statisticsEntity.timeSeriesType = interval;
	}



	// Accumulate staking values

	statisticsEntity.totalMembers = pass.getMembersCount()
	if (stat != null) {
		statisticsEntity.totalPlayers = stat.totalPlayers;
	} else {
		statisticsEntity.totalPlayers = BigInt.fromI32(0);
	}


	// Save the updated entity
	statisticsEntity.save();
}



export function handleHourBlock(block: ethereum.Block): void {
	savePlayersStatistics(block, "hour");
	savePlayersStatistics(block, "day");
	savePlayersStatistics(block, "week");
}