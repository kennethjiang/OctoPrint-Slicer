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

    function OverridesViewModel(parameters, array_keys, enum_keys, item_keys) {
        var self = this;
        self.slicingViewModel = parameters[0];

        var ARRAY_KEYS = (typeof array_keys === 'undefined') ? [] : array_keys,
            ENUM_KEYS = (typeof enum_keys === 'undefined') ? {} : enum_keys,
            ITEM_KEYS = (typeof item_keys === 'undefined') ? [] : item_keys;
        var ALL_KEYS = ITEM_KEYS.concat(ARRAY_KEYS).concat(Object.keys(ENUM_KEYS));

        // initialize all observables
        _.forEach(ALL_KEYS, function(k) { self["profile." + k] = ko.observable(); });

        self.optionsForKey = function(key) {
            return ENUM_KEYS[key];
        };
	var endings = {};
	self.stripEndings = function(m, k) {
	    if (_.isString(m[k]) && m[k].endsWith("%")) {
		endings[k] = "%";
		return m[k].slice(0,-1);
	    } else {
		return m[k];
	    }
	}

        self.updateOverridesFromProfile = function(profile) {
            _.forEach(ITEM_KEYS, function(k) { self["profile." + k]( self.stripEndings(profile,k) ); });
            _.forEach(ENUM_KEYS, function(v, k) { self["profile." + k]( profile[k] ); });
            _.forEach(ARRAY_KEYS, function(k) {
		if (_.isArray(profile[k])) {
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
                         "optionsForKey"]
            });
            _.forEach(ITEM_KEYS, function(k) {
		if(k in endings) {
		    result[k] += endings;
		}});

            for (var key in result) {
                if (_.contains(ARRAY_KEYS, key.replace("profile.", ""))) {
                    result[key] = [result[key]];
                }
            }
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
                             "solid_layer_thickness",
                             "support",
                             "support_material",
                             "overhangs"]);
    }

    function AdvancedOverridesViewModel(parameters) {
        OverridesViewModel.call(this, parameters,
                            ["start_gcode",
                             "end_gcode",
                             "filament_diameter"],
                            { "platform_adhesion" : ko.observableArray(["none", "brim", "raft"])},
                            ["retraction_enable",
                             "travel_speed",
                             "outer_shell_speed",
                             "inner_shell_speed",
                             "infill_speed",
                             "fan_enabled",
			     "cooling",
                             "bottom_layer_speed",
                             "filament_flow",
			     "extrusion_multiplier"
                             ]);
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
