import json
from collections import defaultdict

with open('./server/data/webmulti_location_info.json', 'r') as f:
    location_info = json.load(f)

with open('./server/data/webmulti_lookup_id_to_name.json', 'r') as f:
    lookup_id_to_name = json.load(f)

with open('./server/data/webmulti_item_table.json', 'r') as f:
    item_table = json.load(f)

location_info_by_room = defaultdict(lambda: defaultdict(list))

for kind, kind_data in location_info.items():
    if kind in ['overworld', 'npcs', 'shops']:
        continue
    for name, (room, mask) in kind_data.items():
        location_info_by_room[kind][room].append((name, mask))

location_info_reversed = defaultdict(dict)
for kind, kind_data in location_info.items():
    if kind not in['overworld', 'npcs', 'shops']:
        continue
    for name, room in kind_data.items():
        location_info_reversed[kind][room] = name


lookup_name_to_id = {v: k for k, v in lookup_id_to_name.items()}