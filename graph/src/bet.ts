// biome-ignore lint/style/useImportType: not supported
// biome-ignore lint/suspicious/noShadowRestrictedNames: not supported
import { ethereum, BigInt } from "@graphprotocol/graph-ts";
import { Bet, Game, Statistics } from "../generated/schema";
import { ID } from "./shared";
import { BetInterface } from "../generated/BetsMemory/BetInterface";

export function handleSetResult(call: ethereum.Call): void {
  const bet = Bet.load(call.to);
  if (bet === null) {
    throw new Error("Bet not found");
  }
  // load bet contract
  const betContract = BetInterface.bind(call.to);
  bet.result = betContract.getResult();
  bet.status = betContract.getStatus();
  bet.save();
  // load statistics
  const stat = Statistics.load(ID);
  if (stat === null) {
    throw new Error("Statistics not found");
  }
  // update game revenue
  const game = Game.load(bet.game);
  if (game === null) {
    throw new Error("Game not found");
  }
  // if fee type is 1, subs result to revenue
  if (game.feeType.equals(BigInt.fromI32(1))) {
    game.revenue = game.revenue.minus(bet.result);
  }
  game.save();
  stat.save();
}