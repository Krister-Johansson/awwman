require("dotenv").config();

const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const log4js = require("log4js");
const tmi = require("tmi.js");

const verifySignature = require("./utils/verifySignature");
const minecraft = require("./utils/minecraft");
const streamloots = require("./utils/streamloots");
const utils = require("./utils");

const {
  PORT,
  PLAYERNAME,
  TWITCH_CLIENT_ID,
  NOTIFICATION_SECRET,
  NGROK_TUNNEL_URL,
  TWITCH_SECRET,
  USERNAME,
  PASSWORD,
  CHANNELS,
} = process.env;

const MESSAGE_TYPE = "Twitch-Eventsub-Message-Type".toLowerCase();
const TWITCH_SUBSCRIPTION_TYPE =
  "Twitch-Eventsub-Subscription-Type".toLowerCase();

const app = express();

const logger = log4js.getLogger();
logger.level = "debug";

minecraft("localhost", 25575, "helloworld");

const twitchClient = new tmi.Client({
  options: { debug: true },
  identity: {
    username: USERNAME,
    password: PASSWORD,
  },
  channels: [CHANNELS],
});

app.use(
  log4js.connectLogger(log4js.getLogger("access"), {
    level: log4js.levels.INFO,
  })
);

app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/login", (req, res) => {
  res.redirect(
    `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${NGROK_TUNNEL_URL}/token&response_type=code&scope=bits:read channel:read:subscriptions`
  );
});

app.get("/token", async (req, res) => {
  const { code } = req.query;

  if (code) {
    axios
      .post(
        `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_SECRET}&code=${code}&grant_type=client_credentials&redirect_uri=${NGROK_TUNNEL_URL}/token`
      )
      .then((result) => console.log(result.data))
      .catch((error) => console.log(error));
  }

  res.redirect("/");
});

app.post(
  "/notification",
  verifySignature(NOTIFICATION_SECRET),
  async (req, res) => {
    switch (req.header(MESSAGE_TYPE)) {
      case "webhook_callback_verification":
        res.send(req.body.challenge);
        break;

      case "notification":
        const {
          from_broadcaster_user_name,
          user_name,
          bits,
          broadcaster_user_name,
          tier,
          is_gift,
        } = req.body.event;

        switch (req.header(TWITCH_SUBSCRIPTION_TYPE)) {
          case "channel.raid":
            logger.info(`${from_broadcaster_user_name} just raided you! <3`);
            res.send("");
            break;

          case "channel.follow":
            const { user_name: follower } = req.body.event;

            logger.info(`${follower} just followed!`);

            const commandChannelFollow = `summon sheep [[PlayerPos]] {CustomName:"\\"${follower}\\"", Color:${utils.randomColor(
              0,
              15
            )}}`;

            const resultChannelFollow = await minecraft.execute(
              commandChannelFollow,
              PLAYERNAME
            );

            if (resultChannelFollow.success) {
              logger.debug(resultChannelFollow.result);
            } else {
              logger.warn(resultChannelFollow.error);
            }

            res.send("");

            break;

          case "channel.cheer":
            logger.info(`${user_name} just cheerd ${bits} bits!`);

            if (bits < 100) {
              res.send("");
              return;
            }

            let totalSummon = utils.countBits(bits);
            let summonCreeper = true;

            if (totalSummon == 0) {
              totalSummon = utils.countChickenBits(bits);
              summonCreeper = false;
            }

            for (let index = 0; index < totalSummon; index++) {
              const resultChannelCheer = await minecraft.execute(
                `summon ${
                  summonCreeper ? "creeper" : "chicken"
                } [[PlayerPos]] {CustomName:"\\"${user_name}\\""}`,
                PLAYERNAME
              );

              if (resultChannelCheer.success) {
                logger.debug(resultChannelCheer.result);
              } else {
                logger.warn(resultChannelCheer.error);
              }
            }
            res.send("");
            break;

          case "channel.subscribe":
            console.log(user_name, broadcaster_user_name, tier, is_gift);

            let command = `summon creeper [[PlayerPos]] {CustomName:"\\"${user_name}\\""}`;

            if (tier == 300) {
              command = `summon creeper [[PlayerPos]] {CustomName:"\\"${user_name}\\"", powered:1}`;
            }

            const result = await minecraft.execute(command, PLAYERNAME);

            if (result.success) {
              logger.debug(result.result);
            } else {
              logger.warn(result.error);
            }
            res.send("");
            break;

          default:
            logger.warn(
              "UNKNOWN: Subscription-Type",
              req.header(TWITCH_SUBSCRIPTION_TYPE),
              req.body
            );
            res.send("");
            break;
        }
        break;

      default:
        logger.warn(
          "UNKNOWN: Twitch-Eventsub-Message-Type",
          req.header(MESSAGE_TYPE),
          req.body
        );
        res.send("");
        break;
    }
  }
);

twitchClient.on("message", async (channel, tags, message, self) => {
  if (tags.username != "streamlootsbot") return;

  let commands = streamloots.parsCommands(message);

  logger.debug(commands);

  if (commands == null) {
    return;
  }

  for (const command of commands) {
    logger.info(`Execute command:${command}`);

    const result = await minecraft.execute(command, PLAYERNAME);
    logger.debug(result);
  }
});

app.listen(PORT, async () => {
  // const runCommand = await minecraft.execute(`say Hello from server`);
  // console.log(runCommand);

  logger.info(`Aww man listening on port ${PORT}`);

  twitchClient
    .connect()
    .then((x) => logger.info("We are connected to chat!"))
    .catch(console.error);
});
