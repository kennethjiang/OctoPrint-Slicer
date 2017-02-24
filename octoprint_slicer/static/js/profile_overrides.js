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

        var ARRAY_KEYS = [
            "print_temperature",
            "start_gcode",
            "end_gcode",
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
            ],
            BOOLEAN_KEYS = [
                "support_material",
                "overhangs",
            "retraction_enable",
                "fan_enabled",
                "cooling"
            ];
        var ALL_KEYS = BOOLEAN_KEYS.concat(ITEM_KEYS).concat(ARRAY_KEYS).concat(Object.keys(ENUM_KEYS));

        // initialize all observables
        _.forEach(ALL_KEYS, function(k) { self["profile." + k] = ko.observable(); });
        _.forEach(ALL_KEYS, function(k) { self["profile." + k].subscribe(
            function() {
                if (self.doneUpdateOverrides) {
                    self.overridesChangedByUser = true;
                }
            })
        });

        self.optionsForKey = function(key) {
            return ENUM_KEYS[key];
        };

        self.updateOverridesFromProfile = function(profile) {

            self.overridesChangedByUser = false;
            self.doneUpdateOverrides = false;

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

            self.doneUpdateOverrides = true;
        };

        // Profile: Determine if slicing parameters have changed and alert user before user reloads slicing profile
        // It is an intricate mess because of the quirkiness of how KO handles events
        // Do NOT change it unless you know what you are doing!
        // TODO: This needs simplication. Or completely get rid of because it's probably over-engineering
        //
        $("#plugin-slicer-reset-overrides-confirm").unbind('click');
        $("#plugin-slicer-reset-overrides-confirm").bind('click', function() {
            self.fetchSlicingProfile( self.slicingViewModel.slicer(), self.slicingViewModel.profile() );
            $("#plugin-slicer-reset-overrides").modal("hide");
        });

        $("#plugin-slicer-reset-overrides").unbind('hidden');
        $("#plugin-slicer-reset-overrides").bind('hidden', function () {
            // We don't have to handle the case when modal is hidden because user clicks "Confirm",
            //  as at that point `self.previousSlicer` and `self.previousProfile` have already changed to new values
            self.slicingViewModel.slicer(self.previousSlicer);
            self.slicingViewModel.profile(self.previousProfile);
        });

        self.onProfileChange = function(newValue) {
            if (newValue === undefined) {  // For some reason KO would fire event with newValue=undefined,
                return;  // in which case we should ignore it otherwise things get messed up
            }

            var slicing = self.slicingViewModel;

            if( !self.previousProfile || !self.previousSlicer ) {
                if( slicing.slicer() && slicing.profile() ) {
                    self.fetchSlicingProfile( slicing.slicer(), slicing.profile() );
                }
                return;
            }

            if (self.previousProfile == slicing.profile() && self.previousSlicer == slicing.slicer() ) {
                return;
            }

            if (self.overridesChangedByUser) {
                $("#plugin-slicer-reset-overrides").modal("show");
            } else {
                self.fetchSlicingProfile( slicing.slicer(), slicing.profile() );
            }
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

            self.previousProfile = profile;
            self.previousSlicer = slicer;
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

            _.forEach(result, function(k) {
                // If the value is undefined, must not be valid for this slicer.
                if (result[k] === undefined) {
                    delete result[k];
                }
            });
            return result;
        };
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        OverridesViewModel,
        [ "slicingViewModel" ],
        [ "#basic_overrides", "#advanced_overrides" ]
        ]);
});
