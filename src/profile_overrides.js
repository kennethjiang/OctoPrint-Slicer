/*
 * View model for OctoPrint-Slicer
 *
 * Author: Kenneth Jiang
 * License: AGPLv3
 */
import { endsWith } from 'lodash-es';
ko.bindingHandlers.numericValue = {
    init : function(element, valueAccessor, allBindings, data, context) {
        var interceptor = ko.computed({
            read: function() {
                return ko.unwrap(valueAccessor());
            },
            write: function(value) {
                if (!isNaN(value)) {
                    valueAccessor()(parseFloat(value));
                }
            },
            disposeWhenNodeIsRemoved: element
        });

        ko.applyBindingsToNode(element, { value: interceptor }, context);
    }
};

export function OverridesViewModel(parameters, array_keys, enum_keys, item_keys, boolean_keys) {
    var self = this;
    self.slicingViewModel = parameters[0];

    var ARRAY_KEYS = [
        "print_temperature",
        "start_gcode",
        "end_gcode",
        "before_layer_gcode",
        "filament_diameter"
    ],
        ENUM_KEYS = {
            "support" : ko.observableArray(["none", "buildplate", "everywhere"]),
            "platform_adhesion" : ko.observableArray(["none", "brim", "raft"])
        },
        ITEM_KEYS = [
            "layer_height",
            "temperature",
            "bed_temperature",
            "print_bed_temperature",
            "fill_density",
            "wall_thickness",
            "print_speed",
            "solid_layer_thickness",
            "travel_speed",
            "outer_shell_speed",
            "inner_shell_speed",
            "infill_speed",
            "bottom_layer_speed",
            "filament_flow",
            "retraction_speed",
            "retraction_amount",
            "extrusion_multiplier",
            "fan_full_height",
            "fan_speed",
            "fan_speed_max",
            "first_layer_temperature",
            "first_layer_bed_temperature",
            "brim_width",
            "skirts",
            "min_skirt_length",
            "brim_line_count",
        ],
        BOOLEAN_KEYS = [
            "support_material",
            "overhangs",
            "retraction_enable",
            "fan_enabled",
            "cooling",
            "fan_always_on",
            "spiral_vase",
        ];

    // Some options, depending on their setting, can force other
    // options.  Overrides happen last so include any trailing "%" if
    // needed.
    const FORCED_SETTINGS = new Map([
        // If spiral_vase...
        ["spiral_vase", new Map([
            // ... is set to 1 ...
            [1,
             // Override all of the following.
             new Map([["ensure_vertical_shell_thickness", 0],
                      ["fill_density", "0%"],
                      ["perimeters", 1],
                      ["top_solid_layers", 0],
                      ["support_material", 0],
                     ])
            ]
        ])]
    ]);

    var ALL_KEYS = BOOLEAN_KEYS.concat(ITEM_KEYS).concat(ARRAY_KEYS).concat(Object.keys(ENUM_KEYS));

    // initialize all observables
    _.forEach(ALL_KEYS, function(k) { self["profile." + k] = ko.observable(); });

    self.optionsForKey = function(key) {
        return ENUM_KEYS[key];
    };

    self.updateOverridesFromProfile = function(profile) {

        // Some options are numeric but might have a percent sign after them.
        // Remove the percent and save it to replace later.
        self.endings = {};
        var stripEndings = function(m, k) {
            if (_.isString(m[k]) && endsWith(m[k], "%")) {
                self.endings[k] = "%";
                return m[k].slice(0,-1);
            } else {
                return m[k];
            }
        }

        // Some options are booleans but can be stored as 0/1 or false/true.
        // Convert to native true/false and keep track of the style.
        self.booleans = {};
        var convertBoolean = function(m, k) {
            var BOOLS = [
                ["false", "true"],
                ["False", "True"],
                ["0", "1"],
            ];
            if (m[k] === undefined) {
                return undefined;
            }
            for (var boolType = 0; boolType < BOOLS.length; boolType++) {
                for (var b = 0; b < BOOLS[boolType].length; b++) {
                    if (m[k] === BOOLS[boolType][b]) {
                        self.booleans[k] = BOOLS[boolType];
                        return !!b;  // Convert 0 to false and 1 to true.
                    }
                }
            }
            return !!m[k]; // Just take a guess if we can't figure it out.
        }


        // Hacky - Slic3r profiles escape new line to be string '\n'
        if (self.slicingViewModel.slicer() == 'slic3r'){
            _.forEach(['end_gcode', 'start_gcode', 'before_layer_gcode'], function(key) {
                profile[key] = profile[key].replace(/\\n/g, '\n');
            });
        }

        // Some options are arrays in cura but not Slic3r.  Keep track of which.
        self.isArray = [];

        _.forEach(ITEM_KEYS, function(k) { self["profile." + k]( stripEndings(profile,k) ); });
        _.forEach(BOOLEAN_KEYS, function(k) { self["profile." + k]( convertBoolean(profile,k) ); });
        _.forEach(ENUM_KEYS, function(v, k) { self["profile." + k]( profile[k] ); });
        _.forEach(ARRAY_KEYS, function(k) {
            // Some config options are arrays in cura but not in Slic3r.
            // Detect which ones are arrays and only convert those.
            if (_.isArray(profile[k])) {
                self.isArray.push(k);  // Remember this for later.
                self["profile." + k](profile[k][0]);
            } else {
                self["profile." + k](profile[k]);
            }});
    };


    self.onProfileChange = function(newValue) {
        if (newValue === undefined) {  // For some reason KO would fire event with newValue=undefined,
            return;  // in which case we should ignore it otherwise things get messed up
        }

        var slicing = self.slicingViewModel;

        if( !slicing.slicer() || !slicing.profile() ) {
            return;
        }

        self.fetchSlicingProfile( slicing.slicer(), slicing.profile() );
    };

    self.fetchSlicingProfile = function(slicer, profile) {
        if (self.profileAjax) {
            self.profileAjax.abort();
            self.profileAjax = undefined;
        }

        self.profileAjax = $.ajax({
            url: API_BASEURL + "slicing/" + slicer + "/profiles/" + profile,
            type: "GET",
            // On success
            success: function(data) {
                self.updateOverridesFromProfile(data.data);
            }
        });
    };

    self.slicingViewModel.profile.subscribe( self.onProfileChange );
    //
    //End of Profile-handling mess


    self.toJS = function() {
        var result = ko.mapping.toJS(self, {
            ignore: ["slicingViewModel",
                "updateOverridesFromProfile",
                "updateOverrides",
                "toJS",
                "optionsForKey",
                "stripEndings",
                "isArray",
                "endings"]
        });
        _.forEach(ITEM_KEYS, function(k) {
            if(self.endings.hasOwnProperty(k)) {
                result["profile." + k] += self.endings[k];
            }});
        _.forEach(BOOLEAN_KEYS, function(k) {
            if(self.booleans.hasOwnProperty(k)) {
                // Convert false/true to the correct string.
                result["profile." + k] = self.booleans[k][result["profile." + k]?1:0];
            }});

        for (var key in result) {
            var baseKey = key.replace("profile.", "");
            // Convert it back to an array if it was an array originally.
            if (_.contains(ARRAY_KEYS, baseKey) && _.contains(self.isArray, baseKey)) {
                result[key] = [result[key]];
            }
        }

        _.forEach(result, function(v, k) {
            // If the value is undefined, must not be valid for this slicer.
            if (k.startsWith("profile.") && result[k] === undefined) {
                delete result[k];
            }
        });

        // Hacky - Slic3r profiles escape new line to be string '\n'
        if (self.slicingViewModel.slicer() == 'slic3r'){
            _.forEach(['profile.end_gcode', 'profile.start_gcode', 'profile.before_layer_gcode'], function(key) {
                result[key] = result[key].replace(/\n/g, '\\n');
            });
        }

        // Do all the overrides.  If there are conflicting overrides,
        // it's going to behave surprisingly.
        for (let key of FORCED_SETTINGS.keys()) {
            let profile_key = "profile." + key;
            if (result.hasOwnProperty(profile_key)) {
                // This key is in our overrides.
                for (let value of FORCED_SETTINGS.get(key).keys()) {
                    if (result[profile_key] == value) {
                        // This value causes overriding.
                        let overrides = FORCED_SETTINGS.get(key).get(value);
                        for (let [overrideKey, overrideValue] of overrides.entries()) {
                            let profile_overrideKey = "profile." + overrideKey;
                            result[profile_overrideKey] = overrideValue;
                        }
                    }
                }
            }
        }

        return result;
    };
}

// view model class, parameters for constructor, container to bind to
OCTOPRINT_VIEWMODELS.push([
    OverridesViewModel,
    [ "slicingViewModel" ],
    [ "#basic_overrides", "#advanced_overrides" ]
]);
