const crypto = require("crypto");

const TWITCH_MESSAGE_ID = "Twitch-Eventsub-Message-Id".toLowerCase();
const TWITCH_MESSAGE_TIMESTAMP =
  "Twitch-Eventsub-Message-Timestamp".toLowerCase();
const TWITCH_MESSAGE_SIGNATURE =
  "Twitch-Eventsub-Message-Signature".toLowerCase();

module.exports = (NOTIFICATION_SECRET) => (req, res, next) => {
  const signature = crypto
    .createHmac("sha256", NOTIFICATION_SECRET)
    .update(
      `${req.header(TWITCH_MESSAGE_ID)}${req.header(TWITCH_MESSAGE_TIMESTAMP)}${
        req.rawBody
      }`
    );

  if (
    `sha256=${signature.digest("hex")}` === req.header(TWITCH_MESSAGE_SIGNATURE)
  ) {
    next();
  } else {
    res.status(403).send("Forbidden");
  }
};
