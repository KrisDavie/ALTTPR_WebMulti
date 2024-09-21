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


def get_changed_locations(sram_diff: dict, old_sram: dict, new_sram: dict) -> list[str]:
    locations = []
    for loc_group, diff_data in sram_diff.items():
        for mem_loc, _ in diff_data.items():
            if loc_group in ["base", "pots", "sprites"]:
                if loc_group in ["base"]:
                    room_id = int(mem_loc) // 2
                    mem_loc = room_id * 2
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
                old_room_data = old_sram[loc_group][mem_loc] | (
                    old_sram[loc_group][mem_loc + 1] << 8
                )
                for name, mask in loc_data.location_info_by_room[loc_group][room_id]:
                    if ((room_data & mask) != (old_room_data & mask)) and (
                        room_data & mask
                    ) != 0:
                        locations.append(name)
            elif loc_group in ["overworld"]:
                try:
                    ow_data = new_sram[loc_group][mem_loc]
                    old_ow_data = old_sram[loc_group][mem_loc]
                    if ((ow_data & 0x40) != (old_ow_data & 0x40)) and (
                        ow_data & 0x40
                    ) != 0:
                        name = loc_data.location_info_reversed[loc_group][mem_loc]
                        locations.append(name)
                    else:
                        for name, mask in loc_data.location_info_by_ow_screen[
                            "bonk_prizes"
                        ][mem_loc]:
                            if ((ow_data & mask) != old_ow_data & mask) and (
                                ow_data & mask
                            ) != 0:
                                locations.append(name)
                except KeyError:
                    logger.error(f"Error getting overworld location: {mem_loc}")
                    continue
            elif loc_group in ["npcs", "bosses"]:
                npc_data = new_sram[loc_group][0] | (new_sram[loc_group][1] << 8)
                old_npc_data = old_sram[loc_group][0] | (old_sram[loc_group][1] << 8)
                for name, mask in loc_data.location_info[loc_group].items():
                    if ((npc_data & mask) != old_npc_data & mask) and (
                        npc_data & mask
                    ) != 0:
                        locations.append(name)
            elif loc_group == "misc":
                misc_data = new_sram[loc_group][mem_loc]
                old_misc_data = old_sram[loc_group][mem_loc]
                for name, mask in loc_data.location_info_by_room[loc_group][mem_loc]:
                    if ((misc_data & mask) != (old_misc_data & mask)) and (
                        misc_data & mask
                    ) != 0:
                        locations.append(name)
            elif loc_group == "shops":
                shop_data = new_sram[loc_group][mem_loc]
                name = loc_data.location_info_reversed[loc_group][0x400000 + mem_loc]
                if int(shop_data) > 0:
                    locations.append(name)
    return locations
