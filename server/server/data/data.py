import json
from collections import defaultdict

with open("./server/data/webmulti_location_info.json", "r") as f:
    location_info = json.load(f)

with open("./server/data/webmulti_lookup_id_to_name.json", "r") as f:
    lookup_id_to_name = json.load(f)

with open("./server/data/webmulti_item_table.json", "r") as f:
    item_table = json.load(f)

location_info_by_room = defaultdict(lambda: defaultdict(list))

for kind, kind_data in location_info.items():
    if kind in ["overworld", "npcs", "shops"]:
        continue
    for name, (room, mask) in kind_data.items():
        location_info_by_room[kind][room].append((name, mask))

location_info_reversed = defaultdict(dict)
for kind, kind_data in location_info.items():
    if kind not in ["overworld", "npcs", "shops"]:
        continue
    for name, room in kind_data.items():
        location_info_reversed[kind][room] = name

lookup_id_to_name['0'] = "Admin Send"
lookup_name_to_id = {v: k for k, v in lookup_id_to_name.items()}
item_table_reversed = {v: k for k, v in item_table.items()}

inventory_lookup: dict[int, dict[int, str]] = {
    # 0x340: {
    #
    #     0x01: ("Bow", 1),
    #     0x02: ("Progressive Bow", 1),
    #     0x03: ("Progressive Bow (Alt)", 1),
    #     0x04: ("Progressive Bow", 2),
    # },
    0x38E: {
        0x80: ("Progressive Bow", 1),  # TODO: Bow?
        0x40: ("Silver Arrows", 1),
        0x20: ("Progressive Bow", 1),
    },
    0x38C: {
        0x01: ("Blue Boomerang", 1),
        0x02: ("Red Boomerang", 1),
        0x04: ("Mushroom", 1),
        0x08: ("Magic Powder", 1),
        0x20: ("Shovel", 1),
        0x40: ("Ocarina", 1),
        0x80: ("Ocarina (Activated)", 1),
    },
    0x342: {0x01: ("Hookshot", 1)},
    # 0x343: {i:  for i in range(0x100)},
    # 0x344: {
    #     0x01: ("Mushroom", 1),
    #     0x02: ("Magic Powder", 1),
    #     0x03: ("Mushroom", 1), ("Magic Powder", 1),
    # },
    0x345: {0x01: ("Fire Rod", 1)},
    0x346: {0x01: ("Ice Rod", 1)},
    0x347: {0x01: ("Bombos", 1)},
    0x348: {0x01: ("Ether", 1)},
    0x349: {0x01: ("Quake", 1)},
    0x34A: {0x01: ("Lamp", 1)},
    0x34B: {0x01: ("Hammer", 1)},
    # 0x34C: {
    #     0x01: ("Shovel", 1),
    #     0x02: ("Ocarina", 1),
    #     0x03: ("Ocarina", 1), ("Ocarina (Activated)", 1),
    #     0x04: ("Shovel", 1), ("Ocarina", 1),
    #     0x05: ("Shovel", 1), ("Ocarina (Activated)", 1),
    # },
    0x34D: {0x01: ("Bug Catching Net", 1)},
    0x34E: {0x01: ("Book of Mudora", 1)},
    0x34F: {
        0x01: ("Bottle", 1),
        0x02: ("Bottle", 2),
        0x03: ("Bottle", 3),
        0x04: ("Bottle", 4),
    },
    0x350: {0x01: ("Cane of Somaria", 1)},
    0x351: {0x01: ("Cane of Byrna", 1)},
    0x352: {0x01: ("Cape", 1)},
    0x353: {0x01: ("Magic Scroll", 1), 0x02: ("Magic Mirror", 1)},
    0x354: {
        0x01: ("Power Glove", 1),
        0x02: ("Titans Mitts", 1),
    },
    0x355: {0x01: ("Pegasus Boots", 1)},
    0x356: {0x01: ("Flippers", 1)},
    0x357: {0x01: ("Moon Pearl", 1)},
    0x359: {
        0x00: ("Fighters Sword", 1),
        0x01: ("Master Sword", 1),
        0x02: ("Tempered Sword", 1),
        0x04: ("Golden Sword", 1),
    },
    0x35A: {
        0x00: ("Fighters Shield", 1),
        0x01: ("Fire Shield", 1),
        0x02: ("Mirror Shield", 1),
    },
    0x35B: {
        0x00: ("Green Mail", 1),
        0x01: ("Blue Mail", 1),
        0x02: ("Red Mail", 1),
    },
    # 0x35C: {
    #     0x02: ("Empty Bottle", 1),
    #     0x03: ("Red Potion", 1),
    #     0x04: ("Green Potion", 1),
    #     0x05: ("Blue Potion", 1),
    #     0x06: ("Fairy", 1),
    #     0x07: ("Bee", 1),
    #     0x08: ("Good Bee", 1),
    # },
    # 0x35D: {
    #     0x02: ("Empty Bottle", 1),
    #     0x03: ("Red Potion", 1),
    #     0x04: ("Green Potion", 1),
    #     0x05: ("Blue Potion", 1),
    #     0x06: ("Fairy", 1),
    #     0x07: ("Bee", 1),
    #     0x08: ("Good Bee", 1),
    # },
    # 0x35E: {
    #     0x02: ("Empty Bottle", 1),
    #     0x03: ("Red Potion", 1),
    #     0x04: ("Green Potion", 1),
    #     0x05: ("Blue Potion", 1),
    #     0x06: ("Fairy", 1),
    #     0x07: ("Bee", 1),
    #     0x08: ("Good Bee", 1),
    # },
    # 0x35F: {
    #     0x02: ("Empty Bottle", 1),
    #     0x03: ("Red Potion", 1),
    #     0x04: ("Green Potion", 1),
    #     0x05: ("Blue Potion", 1),
    #     0x06: ("Fairy", 1),
    #     0x07: ("Bee", 1),
    #     0x08: ("Good Bee", 1),
    # },
    0x36B: {
        0x01: ("Piece of Heart", 1),
        0x02: ("Piece of Heart", 2),
        0x03: ("Piece of Heart", 3),
        0x04: ("Piece of Heart", 4),
    },
}

dungeon_masks = {
    0: {
        "Ganons Tower": 0x4,
        "Turtle Rock": 0x8,
        "Thieves Town": 0x10,
        "Tower of Hera": 0x20,
        "Ice Palace": 0x40,
        "Skull Woods": 0x80,
    },
    1: {
        "Misery Mire": 0x1,
        "Palace of Darkness": 0x2,
        "Swamp Palace": 0x4,
        "Agahnims Tower": 0x8,
        "Desert Palace": 0x10,
        "Eastern Palace": 0x20,
        "Escape": 0x40,
    },
}

small_key_sram_locs = {
    "Escape": 0x4E0,
    "Eastern Palace": 0x4E2,
    "Desert Palace": 0x4E3,
    "Agahnims Tower": 0x4E4,
    "Swamp Palace": 0x4E5,
    "Palace of Darkness": 0x4E6,
    "Misery Mire": 0x4E7,
    "Skull Woods": 0x4E8,
    "Ice Palace": 0x4E9,
    "Tower of Hera": 0x4EA,
    "Thieves Town": 0x4EB,
    "Turtle Rock": 0x4EC,
    "Ganons Tower": 0x4ED,
}
