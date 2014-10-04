(function(DOM, VALIDITY_KEY, VALIDITY_TOOLTIP_KEY, PATTERNS, I18N_MISMATCH) {
    "use strict";

    var hasCheckedRadio = function(el) {
            return el.get("name") === this.get("name") && el.get("checked");
        };

    DOM.extend("input[name],select[name],textarea[name]", {
        constructor: function() {
            var type = this.get("type");

            if (type !== "checkbox" && type !== "radio") {
                if (type === "textarea") this.on("input", this.onTextareaInput);

                this.on("input", this.onValidityCheck);
            }

            this.on("change", this.onValidityUpdate);
        },
        validity: function(errors) {
            if (arguments.length) return this.set(VALIDITY_KEY, errors);

            var type = this.get("type"),
                value = this.get("value"),
                required = this.matches("[required]"),
                regexp, pattern, msg;

            errors = this.get(VALIDITY_KEY);

            if (typeof errors === "function") errors = errors.call(this);
            if (typeof errors === "string") errors = [errors];

            errors = errors || [];

            if (!errors.length) {
                switch(type) {
                case "image":
                case "submit":
                case "button":
                case "select-one":
                case "select-multiple":
                    // only check custom error case
                    break;

                case "radio":
                    if (!required || this.closest("form").findAll("[name]").some(hasCheckedRadio, this)) break;
                    /* falls through */
                case "checkbox":
                    if (required && !this.get("checked")) {
                        errors.push("can't be empty");
                    }
                    break;

                default:
                    if (value) {
                        if (type === "textarea") break;

                        pattern = this.get("pattern");

                        if (pattern) {
                            pattern = "^(?:" + pattern + ")$";

                            if (pattern in PATTERNS) {
                                regexp = PATTERNS[pattern];
                            } else {
                                regexp = new RegExp(pattern);
                                // cache regexp internally
                                PATTERNS[pattern] = regexp;
                            }

                            msg = this.get("title") || "illegal value format";
                        } else {
                            regexp = PATTERNS[type];
                            msg = I18N_MISMATCH[type];
                        }

                        if (regexp && !regexp.test(value)) {
                            errors.push(msg);
                        }
                    } else if (required) {
                        errors.push("can't be empty");
                    }
                }
            }

            return errors;
        },
        onValidityCheck: function() {
            if (!this.get("aria-invalid")) return;

            var errors = this.validity();

            if (errors.length) {
                this.fire("validity:fail", errors);
            } else {
                this.fire("validity:ok");
            }
        },
        onValidityUpdate: function() {
            var errors = this.validity();

            if (errors.length) {
                this.fire("validity:fail", errors);
            } else {
                this.fire("validity:ok");
            }
        },
        onTextareaInput: function() {
            // maxlength fix for textarea
            var maxlength = parseFloat(this.get("maxlength")),
                value = this.get();

            if (maxlength && value.length > maxlength) {
                this.set(value.substr(0, maxlength));
            }
        }
    });

    DOM.extend("form", {
        constructor: function() {
            this
                .set("novalidate", "novalidate") // disable native validation
                .on("submit", this.onFormSubmit)
                .on("reset", this.onFormReset);
        },
        validity: function(errors) {
            if (arguments.length) return this.set(VALIDITY_KEY, errors);

            errors = this.get(VALIDITY_KEY);

            if (typeof errors === "function") errors = errors.call(this);
            if (typeof errors === "string") errors = {0: errors, length: 1};

            if (errors) {
                errors.length = errors.length || 0;
            } else {
                errors = {length: 0};
            }

            this.findAll("[name]").forEach(function(el) {
                var name = el.get("name");

                if (!(name in errors)) {
                    errors[name] = el.validity && el.validity();
                }

                if (errors[name] && errors[name].length) {
                    errors.length += errors[name].length;
                } else {
                    delete errors[name];
                }
            });

            return errors;
        },
        onFormSubmit: function() {
            var errors = this.validity();

            if (errors.length) {
                // fire event on form level
                this.fire("validity:fail", errors);

                return false;
            }
        },
        onFormReset: function() {
            this.findAll("[name]").forEach(function(el) {
                var tooltip = el.get(VALIDITY_TOOLTIP_KEY);

                if (tooltip) tooltip.hide();
            });
        }
    });

    DOM.on("validity:ok", ["target", "defaultPrevented"], function(target, cancel) {
        target.set("aria-invalid", false);

        if (!cancel) target.popover().hide();
    });

    DOM.on("validity:fail", [1, 2, "target", "defaultPrevented"], function(errors, coef, target, cancel) {
        target.set("aria-invalid", true);

        if (cancel || !errors.length) return;

        if (target.toString() === "form") {
            Object.keys(errors).forEach(function(name, index) {
                target.find("[name=\"" + name + "\"]")
                    .fire("validity:fail", errors[name], index + 1);
            });
        } else {
            var errorMessage = DOM.i18n(typeof errors === "string" ? errors : errors[0]),
                popover = target.popover(errorMessage.toString(), "left", "bottom"),
                delay = 0;

            // hiding the tooltip to show later with a small delay
            popover.hide().addClass("better-validity-tooltip");

            if (coef) {
                delay = popover.css("transition-duration");
                // parse animation duration value
                delay = parseFloat(delay) * (delay.slice(-2) === "ms" ? 1 : 1000);
                // use extra delay for each next form melement
                delay = delay * coef / target.get("form").length;
            }

            // use a small delay if several tooltips are going to be displayed
            setTimeout(function() { popover.show() }, delay);
        }
    });
}(window.DOM, "_validity", "_validityTooltip", {
    email: new RegExp("^([a-z0-9_\\.\\-\\+]+)@([\\da-z\\.\\-]+)\\.([a-z\\.]{2,6})$", "i"),
    url: new RegExp("^(https?:\\/\\/)?[\\da-z\\.\\-]+\\.[a-z\\.]{2,6}[#&+_\\?\\/\\w \\.\\-=]*$", "i"),
    tel: new RegExp("^((\\+\\d{1,3}(-| )?\\(?\\d\\)?(-| )?\\d{1,5})|(\\(?\\d{2,6}\\)?))(-| )?(\\d{3,4})(-| )?(\\d{4})(( x| ext)\\d{1,5}){0,1}$"),
    number: new RegExp("^-?[0-9]*(\\.[0-9]+)?$")
}, {
    email: "should be a valid email",
    url: "should be a valid URL",
    tel: "should be a valid phone number",
    number: "should be a numeric value"
}));
