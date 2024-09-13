# This file is intended to be run from the OR codebase in order to generate the data files needed for WebMulti to function.

import json
import logging

from BaseClasses import PotItem, PotFlags, LocationType
import Items
import Regions
import PotShuffle
import source.dungeon.EnemyList as EnemyList
import source.rom.DataTables as DataTables
from MultiClient import location_table_uw, location_table_ow, location_table_misc, location_table_npc, location_table_boss

lookup_id_to_name = {x: y for x, y in Regions.lookup_id_to_name.items()}
lookup_name_to_id = {x: y for x, y in Regions.lookup_name_to_id.items()}
location_table_pot_items = {}
location_table_sprite_items = {}
for super_tile, pot_list in PotShuffle.vanilla_pots.items():
    for pot_index, pot in enumerate(pot_list):
        if pot.item != PotItem.Hole:
            if pot.item == PotItem.Key:
                loc_name = next(loc for loc, datum in PotShuffle.key_drop_data.items()
                                if datum[1] == super_tile)
            else:
                descriptor = 'Large Block' if pot.flags & PotFlags.Block else f'Pot #{pot_index+1}'
                loc_name = f'{pot.room} {descriptor}'
            location_table_pot_items[loc_name] = (2 * super_tile, 0x8000 >> pot_index)
            location_id = Regions.pot_address(pot_index, super_tile)
            lookup_name_to_id[loc_name] = location_id
            lookup_id_to_name[location_id] = loc_name
uw_table = DataTables.get_uw_enemy_table()
key_drop_data = {(v[1][1], v[1][2]): k for k, v in PotShuffle.key_drop_data.items() if v[0] == 'Drop'}
for super_tile, enemy_list in uw_table.room_map.items():
    index_adj = 0
    for index, sprite in enumerate(enemy_list):
        if sprite.sub_type == 0x07:  # overlord
            index_adj += 1
            continue
        if (super_tile, index) in key_drop_data:
            loc_name = key_drop_data[(super_tile, index)]
            location_id = PotShuffle.key_drop_data[loc_name][1][0]
        else:
            loc_name = f'{sprite.region} Enemy #{index+1}'
            location_id = EnemyList.drop_address(index, super_tile)
        if index < index_adj:
            print(f'Problem at {hex(super_tile)} {loc_name}')
        location_table_sprite_items[loc_name] = (2 * super_tile, 0x8000 >> (index-index_adj))
        lookup_name_to_id[loc_name] = location_id
        lookup_id_to_name[location_id] = loc_name

item_table = {}
for item, data in Items.item_table.items():
    if type(data[3]) != list and data[3] != 'None' and data[3] < 512:
        item_table[data[3]] = item

from Regions import bonk_prize_table
from OWEdges import OWTileRegions

location_table_bonk = {}

for location, (_, flag, _, _, region_name, _) in bonk_prize_table.items():
    if region_name == 'Good Bee Cave (back)': continue
    screen_id = OWTileRegions[region_name]
    location_table_bonk[location] = (screen_id, flag)

location_info = {'base': location_table_uw, 
                 'overworld': location_table_ow, 
                 'npcs': location_table_npc,
                 'misc': location_table_misc,
                 'pots': location_table_pot_items,
                 'sprites': location_table_sprite_items,
                 'shops': Regions.shop_table_by_location, 
                 'bosses': location_table_boss,
                 'bonk_prizes': location_table_bonk,
                 }

with open('webmulti_location_info.json', 'w') as f:
    json.dump(location_info, f, indent=4)

with open('webmulti_lookup_id_to_name.json', 'w') as f:
    json.dump(lookup_id_to_name, f, indent=4)

with open('webmulti_item_table.json', 'w') as f:
    json.dump(item_table, f, indent=4)

with open('items.json', 'w') as f:
    json.dump({v: k for k, v in item_table.items()}, f, indent=4)
