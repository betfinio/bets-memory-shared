// biome-ignore lint/style/useImportType: not supported
import { NewBet as NewBetEvent, } from "../generated/BetsMemory/BetsMemory"
import { Bet, Game, Player, Statistics, } from "../generated/schema"
import { BetInterface } from "../generated/BetsMemory/BetInterface";
// biome-ignore lint/style/useImportType: not supported
// biome-ignore lint/suspicious/noShadowRestrictedNames: not supported
import { BigInt, ethereum } from "@graphprotocol/graph-ts";
import { BetTemplate } from "../generated/templates";
import { ID } from "./shared";
import { GameInterface } from "../generated/templates/Bet/GameInterface";


export function handleNewBet(event: NewBetEvent): void {
	// load statistics
	const stat = Statistics.load(ID);
	if (stat === null) {
		throw new Error('Statistics not found');
	}
	// load bet contract
	const contract = BetInterface.bind(event.params.bet)
	// get bet amount
	const betAmount = contract.getAmount();
	// create bet entity
	const betEntity = new Bet(
		event.params.bet
	)
	// get game address
	const gameAddress = contract.getGame();
	if (!gameAddress) {
		throw new Error("Game not found");
	}
	// load game
	const gameInterface = GameInterface.bind(gameAddress);

	const feeType = gameInterface.getFeeType();

	let game = Game.load(event.params.game);
	if (game === null) {
		// get fee type
		game = new Game(event.params.game);
		game.address = event.params.game;
		game.feeType = feeType;
		game.revenue = BigInt.zero();
	}
	if (feeType.equals(BigInt.fromI32(0))) {
		game.revenue = game.revenue.plus(betAmount.times(BigInt.fromI32(360)).div(BigInt.fromI32(10000)));
	}
	game.save();


	// load player
	let player = Player.load(event.params.player);
	// create player entity
	if (player === null) {
		player = new Player(event.params.player);
		player.address = event.params.player;
		player.betsCount = BigInt.fromI32(1);
		player.betsAmount = betAmount;
		stat.totalPlayers = stat.totalPlayers.plus(BigInt.fromI32(1));
		stat.totalBets = stat.totalBets.plus(BigInt.fromI32(1));
		stat.totalVolume = stat.totalVolume.plus(betAmount);
	} else {
		player.betsCount = player.betsCount.plus(BigInt.fromI32(1));
		player.betsAmount = player.betsAmount.plus(betAmount);
		stat.totalBets = stat.totalBets.plus(BigInt.fromI32(1));
		stat.totalVolume = stat.totalVolume.plus(betAmount);
	}
	player.save();
	stat.save();


	// set bet entity
	betEntity.bet = event.params.bet
	betEntity.player = player.id
	betEntity.game = game.id;
	betEntity.amount = betAmount;
	betEntity.result = BigInt.fromI32(0);
	betEntity.status = contract.getStatus();
	betEntity.blockNumber = event.block.number
	betEntity.blockTimestamp = event.block.timestamp
	betEntity.transactionHash = event.transaction.hash
	// create bet template
	BetTemplate.create(event.params.bet)

	betEntity.save()
}

export function handleOnce(block: ethereum.Block): void {
	const stat = new Statistics(ID)
	stat.totalBets = BigInt.zero();
	stat.totalVolume = BigInt.zero();
	stat.totalPlayers = BigInt.zero();
	stat.save()
}