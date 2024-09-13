import json
from collections import defaultdict

with open("./server/data/webmulti_location_info.json", "r") as f:
    location_info = json.load(f)

with open("./server/data/webmulti_lookup_id_to_name.json", "r") as f:
    lookup_id_to_name = json.load(f)

with open("./server/data/webmulti_item_table.json", "r") as f:
    item_table = json.load(f)

location_info_by_room = defaultdict(lambda: defaultdict(list))
location_info_reversed = defaultdict(dict)
location_info_by_ow_screen = defaultdict(lambda: defaultdict(list))

for kind, kind_data in location_info.items():
    if kind in ["base", "pots", "sprites"]:
        for name, (room, mask) in kind_data.items():
            location_info_by_room[kind][room].append((name, mask))
    elif kind in ["overworld", "npcs", "shops"]:
        for name, mask in kind_data.items():
            location_info_reversed[kind][mask] = name
    elif kind in ["bonk_prizes"]:
        for name, (screen, mask) in kind_data.items():
            location_info_by_ow_screen[kind][screen].append((name, mask))
    




lookup_id_to_name['0'] = "Admin Send"
lookup_name_to_id = {v: k for k, v in lookup_id_to_name.items()}
item_table_reversed = {v: k for k, v in item_table.items()}
