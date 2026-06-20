import { useEffect, useRef } from "react";

const READ_ONLY_CONTROLS = [
  "input",
  "textarea",
  "select",
  ".dash-btn",
  "button:not(.dash-tabs button):not(.dash-product-nav__tab)",
  "a.dash-btn",
  ".dash-link-btn",
  ".dash-opp-mini__btn"
].join(",");

export default function MentorStudentReadOnlyPage({ children }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const controls = [...(containerRef.current?.querySelectorAll(READ_ONLY_CONTROLS) || [])];
    const previous = controls.map((control) => ({
      control,
      disabled: "disabled" in control ? control.disabled : undefined,
      ariaDisabled: control.getAttribute("aria-disabled"),
      tabIndex: control.getAttribute("tabindex")
    }));

    controls.forEach((control) => {
      if ("disabled" in control) control.disabled = true;
      control.setAttribute("aria-disabled", "true");
      if (!("disabled" in control)) control.setAttribute("tabindex", "-1");
    });

    return () => {
      previous.forEach(({ control, disabled, ariaDisabled, tabIndex }) => {
        if (disabled !== undefined) control.disabled = disabled;
        if (ariaDisabled === null) control.removeAttribute("aria-disabled");
        else control.setAttribute("aria-disabled", ariaDisabled);
        if (tabIndex === null) control.removeAttribute("tabindex");
        else control.setAttribute("tabindex", tabIndex);
      });
    };
  }, [children]);

  return <div ref={containerRef} className="dash-mentor-view-readonly">{children}</div>;
}
