/*
 * View model for OctoPrint-Slicer
 *
 * Author: Kenneth Jiang
 * License: AGPLv3
 */
$(function() {
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

    function OverridesViewModel(parameters, array_keys, enum_keys, item_keys, boolean_keys) {
        var self = this;
        self.slicingViewModel = parameters[0];

        var ARRAY_KEYS = (typeof array_keys === 'undefined') ? [] : array_keys,
            ENUM_KEYS = (typeof enum_keys === 'undefined') ? {} : enum_keys,
            ITEM_KEYS = (typeof item_keys === 'undefined') ? [] : item_keys,
            BOOLEAN_KEYS = (typeof boolean_keys === 'undefined') ? [] : boolean_keys;
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
                if (_.isString(m[k]) && m[k].endsWith("%")) {
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

        self.updateOverrides = function(newValue) {
            var slicing = self.slicingViewModel;

            if ( slicing.profile() && slicing.slicer()
                && (self.previousProfile != slicing.profile() || self.previousSlicer != slicing.slicer()) ) {
                $.ajax({
                    url: API_BASEURL + "slicing/" + slicing.slicer() + "/profiles/" + slicing.profile(),
                    type: "GET",
                    // On success
                    success: function(data) {
                        self.updateOverridesFromProfile(data.data);
                    }
                });
            }
            self.previousProfile = slicing.profile();
            self.previousSlicer = slicing.slicer();
        };

        self.slicingViewModel.profile.subscribe( self.updateOverrides );
        self.slicingViewModel.slicer.subscribe( self.updateOverrides );

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

            _.forEach(result, function(k) {
                // If the value is undefined, must not be valid for this slicer.
                if (result[k] === undefined) {
                    delete result[k];
                }
            });
            return result;
        };
    }

    function BasicOverridesViewModel(parameters) {
        OverridesViewModel.call(this, parameters,
            ["print_temperature"],
            { "support" : ko.observableArray(["none", "buildplate", "everywhere"])},
            ["layer_height",
                "temperature",
                "bed_temperature",
                "print_bed_temperature",
                "fill_density",
                "wall_thickness",
                "print_speed",
                "solid_layer_thickness"],
            ["support_material",
                "overhangs"]);
    }

    function AdvancedOverridesViewModel(parameters) {
        OverridesViewModel.call(this, parameters,
            ["start_gcode",
                "end_gcode",
                "filament_diameter"],
            { "platform_adhesion" : ko.observableArray(["none", "brim", "raft"])},
            ["travel_speed",
                "outer_shell_speed",
                "inner_shell_speed",
                "infill_speed",
                "bottom_layer_speed",
                "filament_flow",
                "retraction_speed",
                "retraction_amount",
                "extrusion_multiplier",
            ],
            ["retraction_enable",
                "fan_enabled",
                "cooling"]);
    }


    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        BasicOverridesViewModel,
        [ "slicingViewModel" ],
        [ "#basic_overrides" ]
    ],
        [
            AdvancedOverridesViewModel,
            [ "slicingViewModel" ],
            [ "#advanced_overrides" ]
        ]);
});
