require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const log4js = require("log4js");
const tmi = require("tmi.js");

const verifySignature = require("./utils/verifySignature");
const minecraft = require("./utils/minecraft");

const { PORT, PLAYERNAME, NOTIFICATION_SECRET, USERNAME, PASSWORD, CHANNELS } =
  process.env;

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

const randomColor = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

const countBits = (userBits) => {
  const target = 500;
  if (userBits < target) return 0;
  return Math.floor(userBits / target);
};

const parsCommands = (data) => {
  const validCommand = data.includes("mc#");
  console.log(`Command is valid:`, validCommand);

  if (!validCommand) return null;

  let rawData = data.split("mc#");
  let dataCommands = rawData.splice(1, 1)[0];
  return dataCommands.split(";");
};

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

app.post(
  "/notification",
  verifySignature(NOTIFICATION_SECRET),
  async (req, res) => {
    switch (req.header(MESSAGE_TYPE)) {
      case "webhook_callback_verification":
        res.send(req.body.challenge);
        break;

      case "notification":
        switch (req.header(TWITCH_SUBSCRIPTION_TYPE)) {
          case "channel.raid":
            const { from_broadcaster_user_name } = req.body.event;

            logger.info(`${from_broadcaster_user_name} just raided you! <3`);
            res.send("");
            return;
            break;

          case "channel.follow":
            const { user_name: follower } = req.body.event;

            logger.info(`${follower} just followed!`);

            const commandChannelFollow = `summon sheep [[PlayerPos]] {CustomName:"\\"${follower}\\"", Color:${randomColor(
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
            const { user_name: userName, bits } = req.body.event;

            logger.info(`${userName} just cheerd ${bits} bits!`);
            const totalBits = countBits(bits);
            logger.debug("totalBits", totalBits);

            const commandChannelCheer = `summon creeper [[PlayerPos]] {CustomName:"\\"${userName}\\""}`;

            for (let index = 0; index < totalBits; index++) {
              const resultChannelCheer = await minecraft.execute(
                commandChannelCheer,
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
            const { user_name, broadcaster_user_name, tier, is_gift } =
              req.body.event;

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

  let commands = parsCommands(message);

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

twitchClient
  .connect()
  .then((x) => logger.info("We are connected to chat!"))
  .catch(console.error);

app.listen(PORT, () => {
  logger.info(`Aww man listening on port ${PORT}`);
});
