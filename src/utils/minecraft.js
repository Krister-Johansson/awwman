const util = require("minecraft-server-util");

const client = new util.RCON();

let settings = {
  server: "localhost",
  port: 25575,
  password: "Shhhh!",
};

const PlayerPosPrefix = "[[PlayerPos]]";
const PlayerNamePrefix = "[[PlayerName]]";

const parsCords = (data) => {
  const lines = data.split("\n");
  const x = lines[1].split(" ");
  const y = lines[2].split(" ");
  const z = lines[3].split(" ");

  return {
    x: x[1].replace(",", ""),
    y: y[1].replace(",", ""),
    z: z[1].replace(",", ""),
  };
};

const getPlayerCoords = async (player) => {
  const rawPlayerCoords = await client.execute(`coords ${player}`);

  if (rawPlayerCoords.includes("Player not found")) {
    return null;
  }
  return parsCords(rawPlayerCoords);
};

const prepareCommand = (command, playerName, player) => {
  if (player != null) {
    command = command.replace(
      PlayerPosPrefix,
      `${player.x} ${player.y} ${player.z}`
    );
  }

  command = command.replace(PlayerNamePrefix, playerName);

  return command;
};

const parsCommand = async (command, playerName) => {
  if (command.includes(PlayerPosPrefix)) {
    const player = await getPlayerCoords(playerName);

    if (player === null) {
      return {
        success: false,
        result: null,
        error: `Player ${playerName} not found`,
      };
    }

    command = prepareCommand(command, playerName, player);

    return {
      success: true,
      result: command,
      error: null,
    };
  } else {
    command = prepareCommand(command, playerName);

    return {
      success: true,
      result: command,
      error: null,
    };
  }
};

const connect = async () => {
  await client.connect(settings.server, settings.port, {
    timeout: 1000 * 5,
  });
  await client.login(settings.password, {
    timeout: 1000 * 5,
  });
};

module.exports = (server, port, password) => {
  settings.server = server;
  settings.port = port;
  settings.password = password;
};

module.exports.execute = async (command, player) => {
  await connect();

  const execute = await parsCommand(command, player);
  if (execute.success === false) {
    await client.close();
    return { success: false, result: null, error: execute.error };
  }

  const result = await client.execute(execute.result);
  await client.close();

  return { success: true, result, error: null };
};
