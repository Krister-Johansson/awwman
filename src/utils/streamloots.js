module.exports.parsCommands = (data) => {
  const validCommand = data.includes("mc#");
  console.log(`Command is valid:`, validCommand);

  if (!validCommand) return null;

  let rawData = data.split("mc#");
  let dataCommands = rawData.splice(1, 1)[0];
  return dataCommands.split(";");
};
