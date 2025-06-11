// biome-ignore lint/style/useImportType: not supported
import { NewBet as NewBetEvent } from "../generated/BetsMemory/BetsMemory"
import { Bet, Player, Statistics, TimeFrameBetsMemoryStatistics } from "../generated/schema"
import { BetInterface } from "../generated/BetsMemory/BetInterface"
// biome-ignore lint/style/useImportType: not supported
// biome-ignore lint/suspicious/noShadowRestrictedNames: shadowing
import { Address, BigInt, Bytes, dataSource, ethereum, log } from "@graphprotocol/graph-ts"
import { Pass } from "../generated/BetsMemory/Pass"

const ID = Bytes.fromUTF8("initial")
const passAddress = Address.fromBytes(dataSource.context().getBytes("pass"))
const pass = Pass.bind(passAddress)

const INTERVALS = new Map<string, i32>()
INTERVALS.set("hour", 3600)
INTERVALS.set("day", 86400)
INTERVALS.set("week", 604800)
const INTERVAL_KEYS = INTERVALS.keys()

const BIG_INT_ZERO = BigInt.zero()
const BIG_INT_ONE = BigInt.fromI32(1)

function getOrCreateStatistics(): Statistics {
	let statistics = Statistics.load(ID)
	if (statistics === null) {
		statistics = new Statistics(ID)
		statistics.totalBets = BIG_INT_ZERO
		statistics.totalVolume = BIG_INT_ZERO
		statistics.totalPlayers = BIG_INT_ZERO
		statistics.save()
	}
	return statistics
}

function getOrCreatePlayer(playerAddress: Bytes, statistics: Statistics): Player {
	let player = Player.load(playerAddress)
	if (player === null) {
		player = new Player(playerAddress)
		player.address = playerAddress
		player.betsCount = BIG_INT_ZERO
		statistics.totalPlayers = statistics.totalPlayers.plus(BIG_INT_ONE)
	}
	return player
}

function getIntervalTimestamp(timestamp: BigInt, interval: string): BigInt {
	const intervalSeconds = INTERVALS.get(interval)
	if (!intervalSeconds) {
		log.warning("Unsupported interval: {}", [interval])
		return timestamp
	}
	const intervalBigInt = BigInt.fromI32(intervalSeconds)
	return timestamp.div(intervalBigInt).times(intervalBigInt)
}

function savePlayersStatistics(block: ethereum.Block, interval: string): void {
	const intervalStart = getIntervalTimestamp(block.timestamp, interval)
	const id = `${intervalStart.toHex()}-${interval}`
	let timeFrameStatistics = TimeFrameBetsMemoryStatistics.load(id)

	if (timeFrameStatistics === null) {
		timeFrameStatistics = new TimeFrameBetsMemoryStatistics(id)
		timeFrameStatistics.timestamp = intervalStart
		timeFrameStatistics.timeSeriesType = interval
		timeFrameStatistics.totalPlayers = BIG_INT_ZERO
		timeFrameStatistics.totalMembers = BIG_INT_ZERO
	}

	const statistics = getOrCreateStatistics()
	timeFrameStatistics.totalMembers = pass.getMembersCount()
	timeFrameStatistics.totalPlayers = statistics.totalPlayers
	timeFrameStatistics.save()
}

export function handleNewBet(event: NewBetEvent): void {
	const statistics = getOrCreateStatistics()
	const player = getOrCreatePlayer(event.params.player, statistics)

	const contract = BetInterface.bind(event.params.bet)
	const betInfo = contract.getBetInfo()
	const amount = betInfo.getValue2()

	const bet = new Bet(event.params.bet)
	bet.bet = event.params.bet
	bet.player = event.params.player
	bet.game = event.params.game
	bet.amount = amount
	bet.status = betInfo.getValue4()
	bet.blockNumber = event.block.number
	bet.blockTimestamp = event.block.timestamp
	bet.transactionHash = event.transaction.hash
	bet.save()

	player.betsCount = player.betsCount.plus(BIG_INT_ONE)
	player.save()

	statistics.totalBets = statistics.totalBets.plus(BIG_INT_ONE)
	statistics.totalVolume = statistics.totalVolume.plus(amount)
	statistics.save()
}

export function handleHourBlock(block: ethereum.Block): void {
	for (let i = 0; i < INTERVAL_KEYS.length; i++) {
		savePlayersStatistics(block, INTERVAL_KEYS[i])
	}
}