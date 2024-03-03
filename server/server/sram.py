import logging

from .data import data as loc_data

logger = logging.getLogger(__name__)

def sram_diff(new_sram: dict, old_sram: dict) -> dict:
    return {
        k: {
            ix: dv
            for ix, dv in enumerate(v)
            if dv != old_sram[k][ix]  # and ix not in ignore_mask[k]
        }
        for k, v in new_sram.items()
        if v != old_sram[k]
    }


def get_dungeon_items(sram: dict) -> dict:
    inv_sram = sram["inventory"]
    found_dungeon_items = []
    c1, c2, b1, b2, m1, m2 = inv_sram[0x364 - 0x340 : 0x36A - 0x340]
    dungeon_items = {
        "Compass": (c1, c2),
        "Big Key": (b1, b2),
        "Map": (m1, m2),
    }
    for item, (s1, s2) in dungeon_items.items():
        for dungeon, mask0 in loc_data.dungeon_masks[0].items():
            if s1 & mask0 != 0:
                found_dungeon_items.append(f"{item} ({dungeon})")
        for dungeon, mask1 in loc_data.dungeon_masks[1].items():
            if s2 & mask1 != 0:
                found_dungeon_items.append(f"{item} ({dungeon})")

    for dungeon, sram_loc in loc_data.small_key_sram_locs.items():
        for i in range(inv_sram[sram_loc - 0x340]):
            found_dungeon_items.append(f"Small Key ({dungeon})")

    return found_dungeon_items


def get_inventory(sram: dict) -> dict:
    inv_sram = sram["inventory"]
    inv_items = []
    for ix, dv in enumerate(inv_sram):
        if dv == 0:
            continue
        if ix + 0x340 not in loc_data.inventory_lookup:
            continue
        for mask, item in loc_data.inventory_lookup[ix + 0x340].items():
            if dv & mask == 0:
                continue
            for i in range(item[1]):
                inv_items.append(item[0])
    inv_items.extend(get_dungeon_items(sram))

    for i in range(4):
        if inv_sram[0x35C - 0x340 + i] != 0:
            inv_items.append(f"Any Bottle")

    return inv_items


def get_changed_locations(sram_diff: dict, new_sram: dict) -> list[str]:
    locations = []
    for loc_group, diff_data in sram_diff.items():
        for mem_loc, _ in diff_data.items():
            if loc_group in ["base", "pots", "sprites"]:
                if loc_group in ["base"]:
                    room_id = int(mem_loc) // 2
                elif loc_group in ["pots", "sprites"]:
                    room_id = (
                        int(mem_loc) if int(mem_loc) % 2 == 0 else int(mem_loc) - 1
                    )
                    mem_loc = room_id
                else:
                    room_id = int(mem_loc)
                if not room_id in loc_data.location_info_by_room[loc_group]:
                    continue
                room_data = new_sram[loc_group][mem_loc] | (
                    new_sram[loc_group][mem_loc + 1] << 8
                )
                for name, mask in loc_data.location_info_by_room[loc_group][room_id]:
                    if room_data & mask != 0:
                        locations.append(name)

            elif loc_group == "overworld":
                try:
                    name = loc_data.location_info_reversed[loc_group][mem_loc]
                    if new_sram[loc_group][mem_loc] & 0x40 != 0:
                        locations.append(name)
                except KeyError:
                    logger.error(f"Error getting overworld location: {mem_loc}")
                    continue

            elif loc_group == "npcs":
                npc_data = new_sram[loc_group][0] | (new_sram[loc_group][1] << 8)
                for name, mask in loc_data.location_info[loc_group].items():
                    if npc_data & mask != 0:
                        locations.append(name)

            elif loc_group == "misc":
                for name, mask in loc_data.location_info_by_room[loc_group][
                    mem_loc + 0x3C6
                ]:
                    if new_sram[loc_group][mem_loc] & mask != 0:
                        locations.append(name)

            elif loc_group == "shops":
                name = loc_data.location_info_reversed[loc_group][0x400000 + mem_loc]
                if int(new_sram[loc_group][mem_loc]) > 0:
                    locations.append(name)
    return locations
