/**
 * Minecraft Bedrock & LeviLamina Server Command Autocomplete & Recommendations
 */

export interface CommandItem {
  name: string;
  syntax: string;
  description: string;
  category: 'general' | 'gameplay' | 'admin' | 'world' | 'levilamina';
  subOptions?: string[];
  nestedOptions?: Record<string, string[]>;
}

export interface SuggestionResult {
  completedValue: string; // The full text to set in input upon selection
  hintText: string;       // Word to show in badge / title
  syntax: string;         // Full syntax explanation
  description: string;    // Description
  category: string;
}

export const SERVER_COMMANDS: CommandItem[] = [
  // General & Utility
  {
    name: 'help',
    syntax: 'help [command: string]',
    description: 'Provides help/list of available commands or info for a specific command.',
    category: 'general',
  },
  {
    name: 'list',
    syntax: 'list',
    description: 'Lists players currently connected to the server.',
    category: 'general',
  },
  {
    name: 'say',
    syntax: 'say <message: text>',
    description: 'Sends a broadcast message in chat to all players.',
    category: 'general',
  },
  {
    name: 'tellraw',
    syntax: 'tellraw <player: target> <raw json message>',
    description: 'Sends a formatted JSON chat message to specific players.',
    category: 'general',
  },
  {
    name: 'tell',
    syntax: 'tell <player: target> <message: text>',
    description: 'Sends a private whisper message to one or more players.',
    category: 'general',
  },

  // Gameplay & Game Modes
  {
    name: 'gamemode',
    syntax: 'gamemode <survival|creative|adventure|spectator|default> [player: target]',
    description: 'Sets a player game mode (survival, creative, adventure, spectator).',
    category: 'gameplay',
    subOptions: ['survival', 'creative', 'adventure', 'spectator', 'default'],
  },
  {
    name: 'difficulty',
    syntax: 'difficulty <peaceful|easy|normal|hard>',
    description: 'Sets the world difficulty level.',
    category: 'gameplay',
    subOptions: ['peaceful', 'easy', 'normal', 'hard'],
  },
  {
    name: 'gamerule',
    syntax: 'gamerule <rule> [value: boolean|int]',
    description: 'Sets or queries a game rule value.',
    category: 'gameplay',
    subOptions: [
      'keepinventory',
      'mobgriefing',
      'dodaylightcycle',
      'doweathercycle',
      'playerssleepingpercentage',
      'naturalregeneration',
      'showcoordinates',
      'pvp',
      'falldamage',
      'firedamage',
      'drowningdamage',
      'domobspawning',
      'domobloot',
      'dotiledrops',
      'doentitydrops',
      'randomtickspeed',
      'commandblocksenabled',
      'sendcommandfeedback',
    ],
    nestedOptions: {
      keepinventory: ['true', 'false'],
      mobgriefing: ['true', 'false'],
      dodaylightcycle: ['true', 'false'],
      doweathercycle: ['true', 'false'],
      naturalregeneration: ['true', 'false'],
      showcoordinates: ['true', 'false'],
      pvp: ['true', 'false'],
      falldamage: ['true', 'false'],
      firedamage: ['true', 'false'],
      drowningdamage: ['true', 'false'],
      domobspawning: ['true', 'false'],
      domobloot: ['true', 'false'],
      dotiledrops: ['true', 'false'],
      doentitydrops: ['true', 'false'],
      commandblocksenabled: ['true', 'false'],
      sendcommandfeedback: ['true', 'false'],
      playerssleepingpercentage: ['0', '50', '100'],
      randomtickspeed: ['1', '3', '10', '20'],
    },
  },
  {
    name: 'time',
    syntax: 'time <set|add|query> <day|night|noon|midnight|0-24000>',
    description: 'Changes or queries the world game time.',
    category: 'world',
    subOptions: ['set', 'add', 'query'],
    nestedOptions: {
      set: ['day', 'night', 'noon', 'midnight', 'sunrise', 'sunset', '1000', '6000', '12000', '18000'],
      add: ['1000', '6000', '12000'],
      query: ['daytime', 'gametime', 'day'],
    },
  },
  {
    name: 'weather',
    syntax: 'weather <clear|rain|thunder> [duration: int]',
    description: 'Sets the weather (clear, rain, or thunder) and duration.',
    category: 'world',
    subOptions: ['clear', 'rain', 'thunder'],
  },
  {
    name: 'tp',
    syntax: 'tp [victim: target] <destination: target | x y z>',
    description: 'Teleports entities (players, mobs) to a destination or coordinates.',
    category: 'gameplay',
  },
  {
    name: 'teleport',
    syntax: 'teleport [victim: target] <destination: target | x y z>',
    description: 'Alias for /tp: Teleports entities to coordinates or entities.',
    category: 'gameplay',
  },
  {
    name: 'give',
    syntax: 'give <player: target> <itemName: string> [amount: int] [data: int]',
    description: 'Gives an item to one or more players.',
    category: 'gameplay',
    subOptions: ['diamond', 'iron_ingot', 'gold_ingot', 'netherite_ingot', 'bread', 'golden_apple', 'totem_of_undying', 'elytra'],
  },
  {
    name: 'clear',
    syntax: 'clear [player: target] [itemName: string] [data: int] [maxCount: int]',
    description: 'Clears items from player inventory.',
    category: 'gameplay',
  },
  {
    name: 'kill',
    syntax: 'kill [target: target]',
    description: 'Kills entities (players, mobs).',
    category: 'gameplay',
    subOptions: ['@e[type=zombie]', '@e[type=skeleton]', '@e[type=item]'],
  },
  {
    name: 'effect',
    syntax: 'effect <player: target> <effect: string | clear> [seconds: int] [amplifier: int]',
    description: 'Applies or clears status effects on players.',
    category: 'gameplay',
    subOptions: ['clear', 'give'],
    nestedOptions: {
      give: ['speed', 'slowness', 'haste', 'strength', 'instant_health', 'instant_damage', 'jump_boost', 'regeneration', 'resistance', 'fire_resistance', 'water_breathing', 'invisibility', 'night_vision', 'slow_falling'],
    }
  },
  {
    name: 'enchant',
    syntax: 'enchant <player: target> <enchantment: string> [level: int]',
    description: 'Enchants a held item of a player.',
    category: 'gameplay',
    subOptions: ['sharpness', 'unbreaking', 'mending', 'protection', 'efficiency', 'fortune', 'looting'],
  },
  {
    name: 'experience',
    syntax: 'experience <add|set|query> <player: target> <amount: int> [levels|points]',
    description: 'Adds or sets player experience points/levels.',
    category: 'gameplay',
    subOptions: ['add', 'set', 'query'],
  },
  {
    name: 'spawnpoint',
    syntax: 'spawnpoint [player: target] [x: int y: int z: int]',
    description: 'Sets the spawn point for a player.',
    category: 'world',
  },
  {
    name: 'setworldspawn',
    syntax: 'setworldspawn [x: int y: int z: int]',
    description: 'Sets the world default spawn point.',
    category: 'world',
  },
  {
    name: 'seed',
    syntax: 'seed',
    description: 'Displays the generation seed of the current world.',
    category: 'world',
  },
  {
    name: 'summon',
    syntax: 'summon <entityType: string> [spawnPos: x y z]',
    description: 'Summons an entity at a given position.',
    category: 'world',
    subOptions: ['zombie', 'skeleton', 'creeper', 'ender_dragon', 'warden', 'iron_golem', 'cow', 'sheep', 'horse', 'villager', 'npc'],
  },
  {
    name: 'locate',
    syntax: 'locate <structure|biome> <feature: string>',
    description: 'Displays the coordinates for the closest structure or biome.',
    category: 'world',
    subOptions: ['structure', 'biome'],
    nestedOptions: {
      structure: ['village', 'mineshaft', 'monument', 'fortress', 'mansion', 'stronghold', 'bastionremnant', 'ancientcity', 'trailruins', 'trialchambers'],
      biome: ['plains', 'desert', 'cherry_grove', 'deep_dark', 'badlands', 'jungle', 'swamp'],
    },
  },
  {
    name: 'title',
    syntax: 'title <player: target> <title|subtitle|actionbar|clear|reset|times> [titleText: text]',
    description: 'Controls screen titles and subtitles shown to players.',
    category: 'general',
    subOptions: ['title', 'subtitle', 'actionbar', 'clear', 'reset', 'times'],
  },
  {
    name: 'tag',
    syntax: 'tag <player: target> <add|remove|list> <name: string>',
    description: 'Manages entity tags on players or mobs.',
    category: 'admin',
    subOptions: ['add', 'remove', 'list'],
  },
  {
    name: 'scoreboard',
    syntax: 'scoreboard <objectives|players> ...',
    description: 'Tracks and displays scores for various objectives.',
    category: 'admin',
    subOptions: ['objectives', 'players'],
    nestedOptions: {
      objectives: ['list', 'add', 'remove', 'setdisplay'],
      players: ['list', 'set', 'add', 'remove', 'reset'],
    },
  },

  // Server Admin & Management
  {
    name: 'kick',
    syntax: 'kick <player: target> [reason: text]',
    description: 'Kicks a player from the server.',
    category: 'admin',
  },
  {
    name: 'ban',
    syntax: 'ban <player: target> [reason: text]',
    description: 'Bans a player from joining the server.',
    category: 'admin',
  },
  {
    name: 'ban-ip',
    syntax: 'ban-ip <ipAddress: string> [reason: text]',
    description: 'Bans an IP address from connecting to the server.',
    category: 'admin',
  },
  {
    name: 'pardon',
    syntax: 'pardon <player: target>',
    description: 'Unbans a previously banned player.',
    category: 'admin',
  },
  {
    name: 'pardon-ip',
    syntax: 'pardon-ip <ipAddress: string>',
    description: 'Removes an IP address from the banned IPs list.',
    category: 'admin',
  },
  {
    name: 'op',
    syntax: 'op <player: target>',
    description: 'Grants operator (admin) permissions to a player.',
    category: 'admin',
  },
  {
    name: 'deop',
    syntax: 'deop <player: target>',
    description: 'Revokes operator permissions from a player.',
    category: 'admin',
  },
  {
    name: 'whitelist',
    syntax: 'whitelist <on|off|list|add|remove|reload>',
    description: 'Manages the server player whitelist (allowlist).',
    category: 'admin',
    subOptions: ['on', 'off', 'list', 'add', 'remove', 'reload'],
  },
  {
    name: 'save-all',
    syntax: 'save-all [flush]',
    description: 'Forces the server to save world chunks to disk.',
    category: 'admin',
    subOptions: ['flush'],
  },
  {
    name: 'save-on',
    syntax: 'save-on',
    description: 'Enables automatic world chunk saving.',
    category: 'admin',
  },
  {
    name: 'save-off',
    syntax: 'save-off',
    description: 'Disables automatic chunk saving (useful before backups).',
    category: 'admin',
  },
  {
    name: 'stop',
    syntax: 'stop',
    description: 'Safely stops the server and flushes all world data to disk.',
    category: 'admin',
  },
  {
    name: 'reload',
    syntax: 'reload',
    description: 'Reloads server scripting behaviors and function packs.',
    category: 'admin',
  },

  // LeviLamina & Lip Commands
  {
    name: 'lip',
    syntax: 'lip <install|uninstall|update|list|search|info> [package: string]',
    description: 'LeviLamina Package Manager CLI.',
    category: 'levilamina',
    subOptions: ['install', 'uninstall', 'update', 'list', 'search', 'info'],
  },
  {
    name: 'version',
    syntax: 'version',
    description: 'Displays current LeviLamina loader and BDS engine version.',
    category: 'levilamina',
  },
  {
    name: 'plugins',
    syntax: 'plugins [reload|list]',
    description: 'Lists or reloads active LeviLamina plugins and mods.',
    category: 'levilamina',
    subOptions: ['list', 'reload'],
  },
];

/**
 * Returns matching suggestions based on the user's input line.
 */
export function getCommandSuggestions(input: string): SuggestionResult[] {
  if (!input) return [];

  const hasLeadingSlash = input.startsWith('/');
  const cleanInput = hasLeadingSlash ? input.slice(1) : input;
  const prefix = hasLeadingSlash ? '/' : '';

  const endsWithSpace = cleanInput.endsWith(' ');
  const tokens = cleanInput.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) return [];

  // Case 1: User is typing the primary command name (e.g. "gam" or "game")
  if (tokens.length === 1 && !endsWithSpace) {
    const search = tokens[0].toLowerCase();
    const matched = SERVER_COMMANDS.filter(cmd => cmd.name.toLowerCase().startsWith(search));
    
    return matched.slice(0, 8).map(cmd => ({
      completedValue: `${prefix}${cmd.name} `,
      hintText: `${prefix}${cmd.name}`,
      syntax: `${prefix}${cmd.syntax}`,
      description: cmd.description,
      category: cmd.category,
    }));
  }

  // Case 2: Primary command is typed, user is typing arguments (e.g. "gamemode " or "gamerule keep")
  const mainCmdName = tokens[0].toLowerCase();
  const cmd = SERVER_COMMANDS.find(c => c.name.toLowerCase() === mainCmdName);
  if (!cmd) return [];

  // Sub-option matching (level 1 argument)
  if ((tokens.length === 1 && endsWithSpace) || (tokens.length === 2 && !endsWithSpace)) {
    const subSearch = tokens.length === 2 ? tokens[1].toLowerCase() : '';
    const subOpts = cmd.subOptions || [];
    const matched = subOpts.filter(opt => !subSearch || opt.toLowerCase().startsWith(subSearch));

    if (matched.length > 0) {
      return matched.slice(0, 8).map(opt => ({
        completedValue: `${prefix}${tokens[0]} ${opt} `,
        hintText: opt,
        syntax: `${prefix}${cmd.syntax}`,
        description: cmd.description,
        category: cmd.category,
      }));
    }

    // Default to displaying the command's syntax if no specific subOptions match
    return [{
      completedValue: `${prefix}${tokens[0]} `,
      hintText: cmd.name,
      syntax: `${prefix}${cmd.syntax}`,
      description: cmd.description,
      category: cmd.category,
    }];
  }

  // Nested option matching (level 2 argument e.g. "time set " or "gamerule keepinventory ")
  if (cmd.nestedOptions) {
    const arg1 = tokens[1]?.toLowerCase();
    const nestedList = cmd.nestedOptions[arg1];

    if (nestedList) {
      if ((tokens.length === 2 && endsWithSpace) || (tokens.length === 3 && !endsWithSpace)) {
        const nestedSearch = tokens.length === 3 ? tokens[2].toLowerCase() : '';
        const matched = nestedList.filter(opt => !nestedSearch || opt.toLowerCase().startsWith(nestedSearch));

        if (matched.length > 0) {
          return matched.slice(0, 8).map(opt => ({
            completedValue: `${prefix}${tokens[0]} ${tokens[1]} ${opt} `,
            hintText: opt,
            syntax: `${prefix}${cmd.syntax}`,
            description: `${cmd.name} ${tokens[1]}: ${cmd.description}`,
            category: cmd.category,
          }));
        }
      }
    }
  }

  // Fallback: show syntax definition of current command
  return [{
    completedValue: input,
    hintText: cmd.name,
    syntax: `${prefix}${cmd.syntax}`,
    description: cmd.description,
    category: cmd.category,
  }];
}
