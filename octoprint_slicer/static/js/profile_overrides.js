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

    function BasicOverridesViewModel(parameters) {
        var ARRAY_KEYS = ["print_temperature"],
            ITEM_KEYS = ["layer_height",
                        "print_bed_temperature",
                        "fill_density",
                        "wall_thickness",
                        "print_speed",
                        "solid_layer_thickness"];

        var ALL_KEYS = ITEM_KEYS.concat(ARRAY_KEYS);


        var self = this;

        self.slicingViewModel = parameters[0];

        // initialize all observables
        _.forEach(ALL_KEYS, function(k) { self["profile." + k] = ko.observable(); });

        self.updateOverrides = function(profile) {
            _.forEach(ITEM_KEYS, function(k) { self["profile." + k]( profile[k] ); });
            _.forEach(ARRAY_KEYS, function(k) { self["profile." + k]( profile[k][0] ); });
        };

        self.updateOverridesFromProfile = function(newValue) {
            var slicing = self.slicingViewModel;

            if ( slicing.profile() && slicing.slicer() ) {
				$.ajax({
					url: API_BASEURL + "slicing/" + slicing.slicer() + "/profiles/" + slicing.profile(),
					type: "GET",
					// On success
					success: function(data) {
                        self.updateOverrides(data.data);
                    }
                });
            }
        };

        self.slicingViewModel.profile.subscribe( self.updateOverridesFromProfile );
        self.slicingViewModel.slicer.subscribe( self.updateOverridesFromProfile );

        self.toJS = function() {
            var result = ko.toJS(self);
            for (var key in result) {
                if (_.contains(ARRAY_KEYS, key.replace("profile.", ""))) {
                    result[key] = [result[key]];
                }
            }
            return result;
        }
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        BasicOverridesViewModel,
        [ "slicingViewModel" ],
        [ "#basic_overrides" ]
    ]);
});
