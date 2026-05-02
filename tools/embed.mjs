// Previous contents had a syntax error (`extends EmbedBuilder()`) and were
// not imported anywhere. Re-export EmbedBuilder so callers that try to
// import { Embed } from this path get something usable.
export { EmbedBuilder as Embed } from "discord.js";
