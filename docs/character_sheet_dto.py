character_sheet_dto = {
    "id": "44444444-4444-4444-8444-444444444444",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z",
    "created_by": "11111111-1111-4111-8111-111111111111",
    "character_id": "22222222-2222-4222-8222-222222222222",
    "name": "Charac",  # character name
    "rule_book": "Opcode",  # default opcode
    "version": "1",  # This is bullshit, does not serve anything right now
    "info": { # info block
        "base": {
            "handle": "", # nickname
            "sex": "", # apparently
            "desc": "", # description for character, markdown
            "appearance": "" # markdown
        },
        "images": {
            "uuid": {"desc": "desc", "title": "title"} # optional description and title and shit
        }
    },
    "stats": { # stats json content
        "stats": {
            "ref": {"base": 10, "mod": 0},
            "int": {"base": 10, "mod": 0},
            "wil": {"base": 10, "mod": 0},
            "chr": {"base": 10, "mod": 0},
            "bod": {"base": 10, "mod": 0},
            "luk": {"base": 10, "mod": 0},
            "extra": {},  # since we don't have any extensions, but users should be allowed to edit this freely
        },
        "derivated": {
            "mov": {"base": 27, "mod": 0},  # bod+ref+2, ref includes status.stats.ref.mod
            "sens": {
                "a": {"base": 35, "mod": 0},  # ref+wil*2
                "v": {"base": 115, "mod": 0},  # ref+wil*10
                "s": {"base": 27, "mod": 0},  # ref+wil+2
            },
            "weight": {"base": 10}, # 20+10*BOD, KG
            "health": {
                "mode": "normal",
                "mul": 1,
                "max": 60,
                "normal": {
                    "head": {"base": 6, "mod": 0},
                    "torso": {"base": 18, "mod": 0},
                    "hand_primary": {"base": 6, "mod": 0},
                    "hand_secondary": {"base": 12, "mod": 0},
                    "leg_left": {"base": 9, "mod": 0},
                    "leg_right": {"base": 9, "mod": 0},
                },
                "simple": {"base": 60, "mod": 0},
            },
        },
        "skills": {
            "base": {
                "perception": {
                    "stat": ["wil"],
                    "base": 10,
                    "mod": 0,
                    "trained": False,
                    "specialization": {
                        "observation": {"base": 10, "mod": 0},
                    },
                },
                "survival": {"stat": ["wil"], "base": 10, "mod": 0},
                "knowledge": {"stat": ["int"], "base": 10, "mod": 0},
                "medical": {"stat": ["wil", "int"], "base": 10, "mod": 0},
                "calm": {"stat": ["wil", "bod"], "base": 10, "mod": 0},
                "social": {"stat": ["chr", "int"], "base": 10, "mod": 0},
                "charm": {"stat": ["chr", "wil", "bod"], "base": 10, "mod": 0},
                "disguise": {"stat": ["chr", "wil"], "base": 10, "mod": 0},
                "camoflauge": {"stat": ["wil", "int"], "base": 10, "mod": 0},
                "operate": {"stat": ["int"], "base": 10, "mod": 0},
                "library": {"stat": ["wil", "int"], "base": 10, "mod": 0},
                "recon": {"stat": ["int"], "base": 10, "mod": 0},
                "manufacture": {"stat": ["int"], "base": 10, "mod": 0},
                "marksmanship": {"stat": ["ref"], "base": 10, "mod": 0},
                "athelete": {"stat": ["ref"], "base": 10, "mod": 0},
                "acrobat": {"stat": ["ref"], "base": 10, "mod": 0},
                "consitution": {"stat": ["bod"], "base": 10, "mod": 0},
                "martial": {"stat": ["ref", "bod"], "base": 10, "mod": 0},
                "projectile": {"stat": ["ref"], "base": 10, "mod": 0},
                "swim": {"stat": ["ref", "bod"], "base": 10, "mod": 0},
                "melee": {"stat": ["bod"], "base": 10, "mod": 0},
                "push": {"stat": ["bod"], "base": 10, "mod": 0},
            },
            "extra": {},
        },
        "rules": {
            "extensions": {},
            "optionals": {},
        },
    },
    "status": { # status json content
        "stats": {
            "ref": {"mod": 5},
            "extra": {},
        },
        "derivated": {
            "sens": {
                "s": {"mod": 10},
            },
        },
        "health": {
            "mode": "normal",
            "normal": {
                "head": {"base": 6, "mod": 0},
                "torso": {"base": 18, "mod": 0},
                "hand_primary": {"base": 6, "mod": 0},
                "hand_secondary": {"base": 12, "mod": 0},
                "leg_left": {"base": 9, "mod": 0},
                "leg_right": {"base": 9, "mod": 0},
            },
        },
        "armor": {
            "normal": {
                "head": 12,
                "torso": 12,
                "hand_primary": 12,
                "hand_secondary": 8,
                "leg_left": 8,
                "leg_right": 8,
            },
        },
        "skills": {
            "base": {

                "charm": {"mod": 10},
            },
            "extra": {},
        },
        "containers": {
            "uuid": {
                "name": "name",
                "weight": {
                    "base": 1.5, # Base weight for container
                    "allows": 5 # Extra carrying weight granted by the container
                },
                "items": [
                    "uuid" # item uuid
                ]
            }
        },
        "inventory": [
            {
                "id": "50000000-0000-4000-8000-000000000001",
                "name": "knife",
                "type": "weapon",
                "skill": {
                    "martial": {
                        "mul": 1,
                        "specialization": {
                            "blade": {
                                "mul": 1,
                            },
                        },
                    },
                    "melee": {
                        "mul": 1,
                    },
                },
                "count": 1,
                "desc": "a short blade",
                "weapon": {
                    "type": "melee",
                    "range": 1,  # attack range in meter
                    "damage": {},  # rd api payload format of damage e.g. 2d6+1
                    "rof": 20,  # rof definition in attacks per minute
                    "mode": 0,
                },
            },
            {
                "id": "50000000-0000-4000-8000-000000000002",
                "name": "aek-971",
                "type": "weapon",
                "count": 1,
                "desc": "aek-971 (kord 6p67)",
                "weapon": {
                    "type": "ranged",
                    "skill": {
                        "marksmanship": {
                            "mul": 1,
                            "specialization": {
                                "rifle": {
                                    "mul": 1,
                                },
                            },
                        },
                    },
                    "range": 400,  # range stat of the weapon,
                    "caliber": "5.45x39",  # caliber, is used to match on ammo
                    "accuracy": 1,  # modifier, can be either positive or negative,
                    "concealability": 3,  # 0:E / 1:G / 2:C / 3:P / 4:N
                    "rof": 900,  # rof definition in rounds fired per minute
                    "mode": 3,  # 0: manual, 1: semi, 2: auto, 4: burst, this one supports semi and auto, this is used as a bitwise data.
                    "reliability": 1,  # 0: very reliable, 1: normal, 2: unreliable
                    "weight": 3.3,  # weight in kg
                    "modifications": {
                        "receiver": {
                            "60000000-0000-4000-8000-000000000001": {
                                "name": "AEK-971 Modernized HG",
                                "effects": {
                                    1: {
                                        "enable_slot": "attachment",
                                        "count": 3,  # Since the thing comes with
                                        "max": 5,  # does not provide count further than max
                                    },
                                    2: {
                                        "enable_slot": "sight",
                                        "count": 1,
                                        "max": 1,
                                    },
                                    3: {
                                        "enable_slot": "underbarrel",
                                        "count": 1,
                                        "max": 1,
                                    },
                                    4: {
                                        "mod": {
                                            "target": "weight",
                                            "value": {
                                                "flat": 0,  # does not provide any weight
                                                # does not have applied_on since it is always applied to the base model.
                                            },
                                        },
                                    },
                                },
                                "description": "The modernized handguard for AEK-971 obr. 2014 (A-545) in accompany of Ratnik program.",
                            },
                        },
                        "attachment": {
                            "60000000-0000-4000-8000-000000000002": {
                                "name": "Perst-4",
                                "effects": {
                                    1: {
                                        "mod": {
                                            "target": "diff",  # one of diff (to-hit bonus), range, caliber, accuracy, concealability, weight
                                            "value": {
                                                "flat": 1,
                                                "applied_on": {
                                                    "range_target": {  # target range % of the range stat when the attachment functions
                                                        "min": 0,
                                                        "max": 1,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    2: {
                                        "mod": {
                                            "target": "weight",
                                            "value": {
                                                "flat": 0.1,
                                            },
                                        },
                                    },
                                },
                                "description": "Laser / IR illuminator module designed by Zenit, can be mounted on picatinny rails.",
                            },
                            "60000000-0000-4000-8000-000000000003": {
                                "name": "Klesh-2P",
                                "effects": {
                                    1: {
                                        "mod": {
                                            "target": "diff",
                                            "value": {
                                                "level": -1,  # To-Hit / diff level / other levels, -1
                                                "applied_on": {
                                                    "text": "low light environments",  # This is a field decided by gm and / or is toggable.
                                                },
                                            },
                                        },
                                    },
                                    2: {
                                        "mod": {
                                            "target": "weight",
                                            "value": {
                                                "flat": 0.1,
                                            },
                                        },
                                    },
                                },
                                "description": "VIS flash light with laser module that can be mounted on picatinny rails, manufactured by Zenit.",
                            },
                        },
                        "muzzle": {
                            "60000000-0000-4000-8000-000000000004": {
                                "name": "6Ch54 Suppressor",
                                "effects": {
                                    1: {
                                        "mod": {
                                            "target": "accuracy",  # one of diff (to-hit bonus), range, caliber, accuracy, concealability, weight
                                            "value": {
                                                "flat": 1,
                                            },
                                        },
                                    },
                                    2: {
                                        "mod": {
                                            "target": "concealability",
                                            "value": {
                                                "level": -1,
                                                "applied_on": {
                                                    "concealability": {  # Does not apply when concealability is above 4.
                                                        "max": 4,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    3: {
                                        "mod": {
                                            "target": "weight",
                                            "value": {
                                                "flat": 0.5,
                                            },
                                        },
                                    },
                                },
                                "description": "6Ch54 Suppressor for AEK-971, manufactured by ZiD.",
                            },
                        },
                        "underbarrel": {
                            "60000000-0000-4000-8000-000000000005": {
                                "name": "RK-3",
                                "effects": {
                                    1: {
                                        "mod": {
                                            "target": "accuracy",
                                            "value": {
                                                "flat": 1,
                                            },
                                        },
                                    },
                                    2: {
                                        "mod": {
                                            "target": "concealability",
                                            "value": {
                                                "level": -1,
                                                "applied_on": {
                                                    "concealability": {  # Does not apply when concealability is above 4.
                                                        "max": 4,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    3: {
                                        "mod": {
                                            "target": "weight",
                                            "value": {
                                                "flat": 0.2,
                                            },
                                        },
                                    },
                                },
                                "description": "RK-3 foregrip for picatinny rail, manufactured by Zenit.",
                            },
                        },
                        "sight": {
                            "60000000-0000-4000-8000-000000000006": {
                                "name": "Razor 1-10x24",
                                "effects": {
                                    0: {
                                        "mod": {
                                            "target": "accuracy",  # one of diff (to-hit bonus), range, caliber, accuracy, concealability, weight
                                            "value": {
                                                "flat": 5,
                                                "applied_on": {
                                                    "range_target": {  # applied from 1-2 max range for long range combat
                                                        "min": 1,
                                                        "max": 2,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    1: {
                                        "mod": {
                                            "target": "accuracy",  # one of diff (to-hit bonus), range, caliber, accuracy, concealability, weight
                                            "value": {
                                                "flat": 3,
                                                "applied_on": {
                                                    "range_target": {  # mid range
                                                        "min": 0.5,
                                                        "max": 1,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    2: {
                                        "mod": {
                                            "target": "accuracy",  # one of diff (to-hit bonus), range, caliber, accuracy, concealability, weight
                                            "value": {
                                                "flat": -3,
                                                "applied_on": {
                                                    "range_target": {  # short range comes with penalties
                                                        "min": 0,
                                                        "max": 0.5,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            {
                "id": "50000000-0000-4000-8000-000000000003",
                "name": "5.45x39mm 7n39 ppbs gs",
                "type": "ammo",
                "count": 20,
                "ammo": {
                    "caliber": "5.45x39",
                    "damage": "ball",
                    "ball": {
                        "damage": {},  # rd payload
                    },  # rd payload
                    "penetration": 55,
                },
                "desc": "",
            },
            {
                "id": "50000000-0000-4000-8000-000000000004",
                "name": "5.45x39mm 7n6 ps gs",
                "type": "ammo",
                "count": 30,    
                "ammo": {
                    "caliber": "5.45x39",
                    "damage": "ball",
                    "ball": {
                        "damage": {},  # rd payload
                    },  # rd payload
                    "penetration": 30,
                },
                "desc": "",
            },
            {
                "id": "50000000-0000-4000-8000-000000000005",
                "name": "12x70 7mm buckshot",
                "type": "ammo",
                "count": 5,
                "ammo": {
                    "caliber": "12x70",
                    "damage": "buck",
                    "buck": {
                        "projectile_count": 5,
                        "damage": {},  # rd payload
                    },
                    "penetration": 10,
                },
                "desc": "",
            },
            {
                "id": "50000000-0000-4000-8000-000000000006",
                "name": "M67 Frag",
                "type": "throwable",
                "count": 5,
                "ammo": {
                    "damage": "explosive",
                    "explosive": {
                        0: {
                            "type": "frag",
                            "damage": {},  # rd payload
                            "lethal": 2,  # lethal range, in meter
                            "wound": 3,  # wound range, extends from the edge of lethal range
                            "persistance": 0,  # effect persistance time
                            "fuse": 5,  # meter, fuse distance
                        },
                    },
                    "penetration": 0,
                },
                "desc": "M67 Fragmentation Grenade issued by NATO forces.",
            },
            {
                "id": "50000000-0000-4000-8000-000000000007",
                "name": "bandage",
                "count": 3,
                "desc": "",
            },
            {
                "id": "60000000-0000-4000-8000-000000000007",
                "name": "Generic Level 3 plate",
                "type": "armor",
                "count": 1,
                "armor": {
                    "material": "ceramic",
                    "layer": 0,  # Layered armor for layer-specific armor calculation
                    "protection": {
                        "normal": {
                            "torso": 45,
                            "hand_primary": 45,
                            "hand_secondary": 45,
                        },
                    },
                },
                "desc": "",
            },
            {},
        ],
    },
}
