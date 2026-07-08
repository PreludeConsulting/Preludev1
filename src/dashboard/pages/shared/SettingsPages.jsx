import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Calendar,
  Camera,
  ChevronRight,
  HelpCircle,
  Link2,
  Mail,
  Monitor,
  Pencil,
  Shield,
  User,
  Users
} from "lucide-react";
import {
  MENTOR_APPLICATION_STRENGTHS,
  MENTOR_COLLEGE_OPTIONS,
  MENTOR_PROGRAM_OPTIONS,
  MENTOR_SPECIALTIES,
  MENTOR_SUPPORT_STYLES,
  MENTOR_TARGET_MAJORS
} from "../../../data/mentorQuestionnaire.js";
import ParentGuardianSettingsPanel from "../../components/settings/ParentGuardianSettingsPanel.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { PARENT_DASHBOARD_BASE, STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { getDemoLinkedChildren, listLinkedChildren } from "../../../lib/parentLinks.js";
import { shouldUseDemoFixtures } from "../../../lib/devAuthBypass.js";
import { loadMentorQuestionnaire, saveMentorProfileSettings } from "../../../lib/mentorQuestionnaireService.js";
import { removeAvatar, uploadAvatar, validateAvatarFile } from "../../../lib/supabaseStorage.js";
import { emitAvatarUpdated, getInitials, isOAuthAvatarUrl, resolveAvatarUrl } from "../../../lib/avatar.js";
import IntegrationConnect from "../../components/IntegrationConnect.jsx";
import SettingsPageShell from "../../components/settings/SettingsPageShell.jsx";
import SecuritySettingsPanel from "../../components/settings/SecuritySettingsPanel.jsx";
import { SaveRow, SettingSelect, SettingToggle } from "../../components/settings/SettingsControls.jsx";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { loadPreferences, savePreferences } from "../../lib/dashboardPreferences.js";
import { getDisplaySettings, getIntegrationCards, getNotificationGroups } from "../../lib/settingsExperience.js";
import { SecondaryButton, SectionCard } from "../../components/ui/index.jsx";

const AVATAR_EXPORT_SIZE = 512;
const AVATAR_EDITOR_SIZE = 260;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function imageToCanvasBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", 0.92);
  });
}

function getPoint(event) {
  const point = event.touches?.[0] || event;
  return { x: point.clientX, y: point.clientY };
}

function AvatarCropEditor({ file, name, onCancel, onSave, saving }) {
  const [imageUrl, setImageUrl] = useState("");
  const [image, setImage] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const canvasRef = useRef(null);
  const initials = getInitials(name, "P").slice(0, 1);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!imageUrl) return undefined;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setImage(img);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = AVATAR_EDITOR_SIZE * dpr;
    canvas.height = AVATAR_EDITOR_SIZE * dpr;
    canvas.style.width = `${AVATAR_EDITOR_SIZE}px`;
    canvas.style.height = `${AVATAR_EDITOR_SIZE}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, AVATAR_EDITOR_SIZE, AVATAR_EDITOR_SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(AVATAR_EDITOR_SIZE / 2, AVATAR_EDITOR_SIZE / 2, AVATAR_EDITOR_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    const baseScale = Math.max(AVATAR_EDITOR_SIZE / image.width, AVATAR_EDITOR_SIZE / image.height);
    const scale = baseScale * zoom;
    const width = image.width * scale;
    const height = image.height * scale;
    const x = (AVATAR_EDITOR_SIZE - width) / 2 + offset.x;
    const y = (AVATAR_EDITOR_SIZE - height) / 2 + offset.y;
    ctx.drawImage(image, x, y, width, height);
    ctx.restore();
  }, [image, offset, zoom]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  function startDrag(event) {
    if (!image || saving) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = getPoint(event);
    dragRef.current = { point, offset };
    setDragging(true);
  }

  function moveDrag(event) {
    if (!dragRef.current || saving) return;
    event.preventDefault();
    const point = getPoint(event);
    const dx = point.x - dragRef.current.point.x;
    const dy = point.y - dragRef.current.point.y;
    setOffset({
      x: dragRef.current.offset.x + dx,
      y: dragRef.current.offset.y + dy
    });
  }

  function endDrag() {
    dragRef.current = null;
    setDragging(false);
  }

  async function handleSave() {
    if (!image) return;
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_EXPORT_SIZE;
    canvas.height = AVATAR_EXPORT_SIZE;
    const ctx = canvas.getContext("2d");
    const exportScale = AVATAR_EXPORT_SIZE / AVATAR_EDITOR_SIZE;
    const baseScale = Math.max(AVATAR_EDITOR_SIZE / image.width, AVATAR_EDITOR_SIZE / image.height);
    const scale = baseScale * zoom * exportScale;
    const width = image.width * scale;
    const height = image.height * scale;
    const x = (AVATAR_EXPORT_SIZE - width) / 2 + offset.x * exportScale;
    const y = (AVATAR_EXPORT_SIZE - height) / 2 + offset.y * exportScale;
    ctx.clearRect(0, 0, AVATAR_EXPORT_SIZE, AVATAR_EXPORT_SIZE);
    ctx.drawImage(image, x, y, width, height);
    const blob = await imageToCanvasBlob(canvas);
    if (!blob) return;
    const croppedFile = new File([blob], "avatar.webp", { type: "image/webp" });
    await onSave(croppedFile);
  }

  return (
    <div className="dash-avatar-crop" role="dialog" aria-label="Edit profile picture">
      <div
        className={`dash-avatar-crop__stage${dragging ? " dash-avatar-crop__stage--dragging" : ""}`}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {image ? <canvas ref={canvasRef} aria-label="Circular crop preview" /> : <span>{initials}</span>}
      </div>
      <label className="dash-avatar-crop__zoom">
        <span>Zoom</span>
        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          onChange={(event) => setZoom(clamp(Number(event.target.value), 1, 3))}
          disabled={!image || saving}
        />
      </label>
      <div className="dash-avatar-crop__actions">
        <SecondaryButton type="button" className="dash-btn--sm" onClick={onCancel} disabled={saving}>
          Cancel
        </SecondaryButton>
        <SecondaryButton type="button" className="dash-btn--sm dash-avatar-crop__save" onClick={handleSave} disabled={!image || saving}>
          {saving ? "Saving…" : "Save photo"}
        </SecondaryButton>
      </div>
    </div>
  );
}

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "zh", label: "Chinese" }
];

const TIME_ZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "America/Phoenix", label: "Arizona Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" }
];

const EMPTY_MENTOR_PROFILE_FORM = {
  college: "",
  major: "",
  bio: "",
  specialties: [],
  targetMajors: [],
  targetSchools: [],
  supportStyles: [],
  applicationStrengths: [],
  availability: "",
  additionalNotes: ""
};

function cleanText(value) {
  return String(value || "").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function accountFormFromUser(user, profile, fallbackRole) {
  const profileAvatar = profile?.avatarUrl || profile?.avatar_url || "";
  const userAvatar = user?.avatarUrl || user?.avatar_url || "";
  const customAvatarUrl = profileAvatar && !isOAuthAvatarUrl(profileAvatar)
    ? profileAvatar
    : userAvatar && !isOAuthAvatarUrl(userAvatar)
      ? userAvatar
      : "";
  return {
    fullName: profile?.fullName || user?.name || "",
    preferredName: profile?.preferredName || "",
    school: profile?.school || "",
    graduationYear: profile?.graduationYear || "",
    gradeLevel: profile?.grade || "",
    timeZone: profile?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    language: profile?.language || "en",
    locationCityState: profile?.locationCityState || "",
    email: profile?.email || user?.email || "",
    role: profile?.role || user?.role || fallbackRole,
    avatarUrl: customAvatarUrl
  };
}

function validateAccountForm(form) {
  const errors = {};
  if (!cleanText(form.fullName)) errors.fullName = "Enter your full name.";
  const year = cleanText(form.graduationYear);
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 2020 || Number(year) > 2045)) {
    errors.graduationYear = "Use a four-digit year between 2020 and 2045.";
  }
  if (cleanText(form.locationCityState) && !/^[a-zA-Z\s.'-]+,\s*[a-zA-Z]{2,}$/.test(cleanText(form.locationCityState))) {
    errors.locationCityState = "Use city and state, for example Atlanta, GA.";
  }
  return errors;
}

function mentorProfileFormFromData(questionnaire, matchingProfile) {
  const answers = questionnaire?.answers || {};
  return {
    ...EMPTY_MENTOR_PROFILE_FORM,
    ...answers,
    college: answers.college ?? matchingProfile?.college ?? "",
    major: answers.major ?? matchingProfile?.major ?? "",
    bio: answers.bio ?? matchingProfile?.bio ?? "",
    specialties: asArray(answers.specialties ?? matchingProfile?.specialties),
    targetMajors: asArray(answers.targetMajors ?? matchingProfile?.target_majors),
    targetSchools: asArray(answers.targetSchools ?? matchingProfile?.target_schools),
    supportStyles: asArray(answers.supportStyles ?? matchingProfile?.support_styles),
    applicationStrengths: asArray(answers.applicationStrengths ?? matchingProfile?.application_strengths),
    availability: answers.availability ?? matchingProfile?.availability ?? "",
    additionalNotes: answers.additionalNotes ?? ""
  };
}

function validateMentorProfileForm(form) {
  const errors = {};
  if (!cleanText(form.college)) errors.college = "Choose or enter your college.";
  if (!cleanText(form.major)) errors.major = "Choose or enter your major.";
  if (!cleanText(form.bio)) errors.bio = "Add a mentor bio.";
  if (!form.specialties.length) errors.specialties = "Choose at least one area.";
  if (!form.targetMajors.length) errors.targetMajors = "Choose at least one academic area.";
  if (!form.supportStyles.length) errors.supportStyles = "Choose at least one support style.";
  if (!form.applicationStrengths.length) errors.applicationStrengths = "Choose at least one strength.";
  if (!cleanText(form.availability)) errors.availability = "Add availability notes.";
  return errors;
}

function MentorMultiSelect({ label, options, value, onChange, error }) {
  const selected = asArray(value);

  function toggle(option) {
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  }

  return (
    <fieldset className="dash-field dash-mentor-profile-settings__group">
      <legend>{label}</legend>
      <div className="dash-mentor-profile-settings__chips">
        {options.map((option) => (
          <label
            key={option}
            className={`dash-mentor-profile-settings__chip${selected.includes(option) ? " dash-mentor-profile-settings__chip--selected" : ""}`}
          >
            <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
            <span>{option}</span>
          </label>
        ))}
      </div>
      {error ? <em>{error}</em> : null}
    </fieldset>
  );
}

function MentorListEditor({ label, value, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const selected = asArray(value);

  function addItem() {
    const next = cleanText(draft);
    if (!next || selected.includes(next)) return;
    onChange([...selected, next]);
    setDraft("");
  }

  return (
    <section className="dash-field dash-mentor-profile-settings__group">
      <span>{label}</span>
      <div className="dash-mentor-profile-settings__add-row">
        <input
          className="dash-input"
          list="mentor-target-school-options"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItem();
            }
          }}
          placeholder={placeholder}
        />
        <button type="button" className="dash-btn dash-btn--secondary dash-btn--sm" onClick={addItem} disabled={!cleanText(draft)}>
          Add
        </button>
      </div>
      <datalist id="mentor-target-school-options">
        {MENTOR_COLLEGE_OPTIONS.map((option) => <option key={option} value={option} />)}
      </datalist>
      {selected.length ? (
        <div className="dash-tags">
          {selected.map((item) => (
            <button
              key={item}
              type="button"
              className="dash-mentor-profile-settings__tag"
              onClick={() => onChange(selected.filter((selectedItem) => selectedItem !== item))}
            >
              {item}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="dash-muted">No schools added yet.</p>
      )}
    </section>
  );
}

function MentorProfileSettingsPanel({ user, profile, useSupabaseData, saveProfile }) {
  const [initialForm, setInitialForm] = useState(EMPTY_MENTOR_PROFILE_FORM);
  const [form, setForm] = useState(EMPTY_MENTOR_PROFILE_FORM);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: "loading", message: "" });

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (!user?.id || !useSupabaseData) {
        const fallback = {
          ...EMPTY_MENTOR_PROFILE_FORM,
          college: profile?.school || "",
          bio: profile?.bio || "",
          targetMajors: asArray(profile?.targetMajors || profile?.majors)
        };
        if (!cancelled) {
          setInitialForm(fallback);
          setForm(fallback);
          setState({ status: "idle", message: "" });
        }
        return;
      }

      setState({ status: "loading", message: "" });
      const { questionnaire, matchingProfile, error } = await loadMentorQuestionnaire(user.id);
      if (cancelled) return;
      const nextForm = mentorProfileFormFromData(questionnaire, matchingProfile);
      setInitialForm(nextForm);
      setForm(nextForm);
      setState(error ? { status: "error", message: error } : { status: "idle", message: "" });
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id, useSupabaseData, profile]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleSave() {
    const nextErrors = validateMentorProfileForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setState({ status: "error", message: "Complete the highlighted mentor profile fields before saving." });
      return;
    }
    if (!useSupabaseData) {
      setState({ status: "error", message: "Mentor profile editing requires a signed-in Supabase session." });
      return;
    }

    const payload = {
      college: cleanText(form.college),
      major: cleanText(form.major),
      bio: cleanText(form.bio),
      specialties: asArray(form.specialties),
      targetMajors: asArray(form.targetMajors),
      targetSchools: asArray(form.targetSchools),
      supportStyles: asArray(form.supportStyles),
      applicationStrengths: asArray(form.applicationStrengths),
      availability: cleanText(form.availability),
      additionalNotes: cleanText(form.additionalNotes)
    };

    setState({ status: "saving", message: "" });
    try {
      const { error } = await saveMentorProfileSettings(user, payload);
      if (error) throw new Error(error);
      await saveProfile({
        school: payload.college,
        bio: payload.bio,
        targetMajors: payload.targetMajors
      });
      setInitialForm(payload);
      setForm(payload);
      setState({ status: "saved", message: "Mentor profile saved." });
      window.setTimeout(() => setState((current) => current.status === "saved" ? { status: "idle", message: "" } : current), 2400);
    } catch (error) {
      setState({ status: "error", message: error?.message || "We could not save your mentor profile. Try again." });
    }
  }

  return (
    <SectionCard title="Mentor profile" className="dash-panel">
      <div className="dash-mentor-profile-settings">
        {state.status === "loading" ? <p className="dash-muted" role="status">Loading mentor profile…</p> : null}
        <div className="dash-form-grid dash-form-grid--settings">
          <label className="dash-field">
            <span>College or university</span>
            <input
              className="dash-input"
              list="mentor-college-options"
              value={form.college}
              onChange={(event) => updateField("college", event.target.value)}
              aria-invalid={Boolean(errors.college)}
            />
            <datalist id="mentor-college-options">
              {MENTOR_COLLEGE_OPTIONS.map((option) => <option key={option} value={option} />)}
            </datalist>
            {errors.college ? <em>{errors.college}</em> : null}
          </label>
          <label className="dash-field">
            <span>Major or program</span>
            <input
              className="dash-input"
              list="mentor-program-options"
              value={form.major}
              onChange={(event) => updateField("major", event.target.value)}
              aria-invalid={Boolean(errors.major)}
            />
            <datalist id="mentor-program-options">
              {MENTOR_PROGRAM_OPTIONS.map((option) => <option key={option} value={option} />)}
            </datalist>
            {errors.major ? <em>{errors.major}</em> : null}
          </label>
          <label className="dash-field dash-form-full">
            <span>Mentor bio</span>
            <textarea
              className="dash-input dash-mentor-profile-settings__textarea"
              value={form.bio}
              onChange={(event) => updateField("bio", event.target.value)}
              rows={4}
              aria-invalid={Boolean(errors.bio)}
              placeholder="Share the admissions topics, student goals, and application moments where you are strongest."
            />
            {errors.bio ? <em>{errors.bio}</em> : null}
          </label>
          <label className="dash-field dash-form-full">
            <span>Availability notes</span>
            <textarea
              className="dash-input dash-mentor-profile-settings__textarea"
              value={form.availability}
              onChange={(event) => updateField("availability", event.target.value)}
              rows={3}
              aria-invalid={Boolean(errors.availability)}
              placeholder="Available weeknights, Sunday afternoons, or by request during application season."
            />
            {errors.availability ? <em>{errors.availability}</em> : null}
          </label>
          <MentorListEditor
            label="Target schools you know well"
            value={form.targetSchools}
            onChange={(value) => updateField("targetSchools", value)}
            placeholder="Add a college or university"
          />
          <label className="dash-field dash-form-full">
            <span>Other strengths or context</span>
            <textarea
              className="dash-input dash-mentor-profile-settings__textarea"
              value={form.additionalNotes}
              onChange={(event) => updateField("additionalNotes", event.target.value)}
              rows={3}
            />
          </label>
        </div>

        <MentorMultiSelect label="Where can you help students most?" options={MENTOR_SPECIALTIES} value={form.specialties} onChange={(value) => updateField("specialties", value)} error={errors.specialties} />
        <MentorMultiSelect label="Which academic areas are a strong fit?" options={MENTOR_TARGET_MAJORS} value={form.targetMajors} onChange={(value) => updateField("targetMajors", value)} error={errors.targetMajors} />
        <MentorMultiSelect label="What is your mentoring style?" options={MENTOR_SUPPORT_STYLES} value={form.supportStyles} onChange={(value) => updateField("supportStyles", value)} error={errors.supportStyles} />
        <MentorMultiSelect label="Which application strengths should matching consider?" options={MENTOR_APPLICATION_STRENGTHS} value={form.applicationStrengths} onChange={(value) => updateField("applicationStrengths", value)} error={errors.applicationStrengths} />

        <div className="dash-form-actions">
          {dirty ? <span className="dash-save-state" role="status">Unsaved changes</span> : null}
          {state.status === "saved" ? <span className="dash-save-state dash-save-state--ok" role="status">{state.message}</span> : null}
          {state.status === "error" ? <span className="dash-save-state dash-save-state--error" role="alert">{state.message}</span> : null}
          <SecondaryButton type="button" className="dash-btn--sm" onClick={() => setForm(initialForm)} disabled={!dirty || state.status === "saving"}>Cancel</SecondaryButton>
          <button type="button" className="dash-btn dash-btn--primary dash-btn--sm" onClick={handleSave} disabled={!dirty || state.status === "saving"}>
            {state.status === "saving" ? "Saving…" : "Save mentor profile"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

function AccountSettingsPanel({ user, profile, roleLabel, useSupabaseData, saveProfile }) {
  const initialForm = useMemo(() => accountFormFromUser(user, profile, roleLabel.toLowerCase()), [user, profile, roleLabel]);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: "idle", message: "" });
  const [avatarState, setAvatarState] = useState({ status: "idle", message: "" });
  const [brokenAvatar, setBrokenAvatar] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    setForm(initialForm);
    setErrors({});
    setBrokenAvatar(false);
  }, [initialForm]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const displayName = form.preferredName || form.fullName || user?.name || "Prelude";
  const initials = getInitials(displayName, "P").slice(0, 1);
  const previewAvatarUrl = resolveAvatarUrl({ user, profile: { avatarUrl: form.avatarUrl || profile?.avatarUrl } });

  useEffect(() => {
    function beforeUnload(event) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleSave() {
    const nextErrors = validateAccountForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setState({ status: "error", message: "Fix the highlighted fields before saving." });
      return;
    }
    setState({ status: "saving", message: "" });
    try {
      const payload = {
        fullName: cleanText(form.fullName),
        preferredName: cleanText(form.preferredName),
        school: cleanText(form.school),
        graduationYear: cleanText(form.graduationYear),
        gradeLevel: cleanText(form.gradeLevel),
        timeZone: form.timeZone,
        language: form.language,
        locationCityState: cleanText(form.locationCityState)
      };
      await saveProfile(payload);
      setState({ status: "saved", message: "Account settings saved." });
      window.setTimeout(() => setState((current) => current.status === "saved" ? { status: "idle", message: "" } : current), 2400);
    } catch {
      setState({ status: "error", message: "We could not save those settings. Try again." });
    }
  }

  async function handleAvatarFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validation = validateAvatarFile(file);
    if (validation) {
      setAvatarState({ status: "error", message: validation });
      event.target.value = "";
      return;
    }
    setCropFile(file);
    setAvatarState({ status: "idle", message: "" });
    event.target.value = "";
  }

  async function handleCroppedAvatarSave(file) {
    if (!useSupabaseData) {
      setAvatarState({ status: "error", message: "Profile photo upload requires a signed-in Supabase session." });
      return;
    }
    setAvatarState({ status: "saving", message: "" });
    try {
      const { url, error } = await uploadAvatar(user.id, file, { previousAvatarUrl: form.avatarUrl });
      if (error) throw new Error(error);
      setForm((current) => ({ ...current, avatarUrl: url || "" }));
      await saveProfile({ avatarUrl: url || "" }, { localOnly: true });
      emitAvatarUpdated(url || "");
      setBrokenAvatar(false);
      setCropFile(null);
      setAvatarState({ status: "saved", message: "Profile photo updated." });
    } catch (error) {
      setAvatarState({ status: "error", message: error?.message || "We could not update your photo. Try another image." });
    }
  }

  async function handleRemoveAvatar() {
    if (!form.avatarUrl) return;
    if (!useSupabaseData) {
      setAvatarState({ status: "error", message: "Profile photo removal requires a signed-in Supabase session." });
      return;
    }
    setAvatarState({ status: "saving", message: "" });
    try {
      const { error } = await removeAvatar(user.id, { previousAvatarUrl: form.avatarUrl });
      if (error) throw new Error(error);
      setForm((current) => ({ ...current, avatarUrl: "" }));
      await saveProfile({ avatarUrl: null }, { localOnly: true });
      emitAvatarUpdated("");
      setBrokenAvatar(false);
      setAvatarState({ status: "saved", message: "Profile photo removed." });
    } catch (error) {
      setAvatarState({ status: "error", message: error?.message || "We could not remove your photo. Try again." });
    }
  }

  return (
    <SectionCard title="Account settings" className="dash-panel">
      <div className="dash-account-settings">
        <div className="dash-avatar-editor">
          <div className="dash-avatar-editor__preview" aria-label="Profile photo preview">
            {previewAvatarUrl && !brokenAvatar ? (
              <img src={previewAvatarUrl} alt="" onError={() => setBrokenAvatar(true)} />
            ) : (
              <span aria-hidden="true">{initials}</span>
            )}
          </div>
          <div className="dash-avatar-editor__actions">
            <input ref={fileRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarFile} />
            <SecondaryButton type="button" className="dash-btn--sm" onClick={() => fileRef.current?.click()} disabled={avatarState.status === "saving"}>
              <Camera className="h-4 w-4" aria-hidden="true" /> {form.avatarUrl ? "Replace photo" : "Upload photo"}
            </SecondaryButton>
            {form.avatarUrl ? (
              <SecondaryButton type="button" className="dash-btn--sm" onClick={handleRemoveAvatar} disabled={avatarState.status === "saving"}>
                Remove
              </SecondaryButton>
            ) : null}
            <p className="dash-setting-row__desc">JPG, PNG, WebP, or GIF. Max 5 MB.</p>
            {avatarState.status === "saving" ? <span className="dash-save-state" role="status">Updating photo…</span> : null}
            {avatarState.status === "saved" ? <span className="dash-save-state dash-save-state--ok" role="status">{avatarState.message}</span> : null}
            {avatarState.status === "error" ? <span className="dash-save-state dash-save-state--error" role="alert">{avatarState.message}</span> : null}
          </div>
        </div>
        {cropFile ? (
          <AvatarCropEditor
            file={cropFile}
            name={displayName}
            saving={avatarState.status === "saving"}
            onCancel={() => {
              setCropFile(null);
              setAvatarState({ status: "idle", message: "" });
            }}
            onSave={handleCroppedAvatarSave}
          />
        ) : null}

        <div className="dash-form-grid dash-form-grid--settings">
          <label className="dash-field">
            <span>Full name</span>
            <input className="dash-input" value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} aria-invalid={Boolean(errors.fullName)} />
            {errors.fullName ? <em>{errors.fullName}</em> : null}
          </label>
          <label className="dash-field">
            <span>Preferred name</span>
            <input className="dash-input" value={form.preferredName} onChange={(event) => updateField("preferredName", event.target.value)} />
          </label>
          <label className="dash-field">
            <span>Email</span>
            <input className="dash-input" value={form.email} readOnly aria-readonly="true" />
          </label>
          <label className="dash-field">
            <span>Role</span>
            <input className="dash-input" value={roleLabel} readOnly aria-readonly="true" />
          </label>
          <label className="dash-field">
            <span>School</span>
            <input className="dash-input" value={form.school} onChange={(event) => updateField("school", event.target.value)} />
          </label>
          <label className="dash-field">
            <span>Graduation year</span>
            <input className="dash-input" inputMode="numeric" value={form.graduationYear} onChange={(event) => updateField("graduationYear", event.target.value)} aria-invalid={Boolean(errors.graduationYear)} />
            {errors.graduationYear ? <em>{errors.graduationYear}</em> : null}
          </label>
          <label className="dash-field">
            <span>Grade level</span>
            <select className="dash-select" value={form.gradeLevel} onChange={(event) => updateField("gradeLevel", event.target.value)}>
              <option value="">Not set</option>
              <option value="9th">9th grade</option>
              <option value="10th">10th grade</option>
              <option value="11th">11th grade</option>
              <option value="12th">12th grade</option>
              <option value="College">College</option>
              <option value="Guardian">Guardian</option>
            </select>
          </label>
          <label className="dash-field">
            <span>Time zone</span>
            <select className="dash-select" value={form.timeZone} onChange={(event) => updateField("timeZone", event.target.value)}>
              {TIME_ZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="dash-field">
            <span>Language</span>
            <select className="dash-select" value={form.language} onChange={(event) => updateField("language", event.target.value)}>
              {LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="dash-field">
            <span>City, state</span>
            <input className="dash-input" placeholder="Atlanta, GA" value={form.locationCityState} onChange={(event) => updateField("locationCityState", event.target.value)} aria-invalid={Boolean(errors.locationCityState)} />
            {errors.locationCityState ? <em>{errors.locationCityState}</em> : null}
          </label>
        </div>

        <div className="dash-form-actions">
          {dirty ? <span className="dash-save-state" role="status">Unsaved changes</span> : null}
          {state.status === "saved" ? <span className="dash-save-state dash-save-state--ok" role="status">{state.message}</span> : null}
          {state.status === "error" ? <span className="dash-save-state dash-save-state--error" role="alert">{state.message}</span> : null}
          <SecondaryButton type="button" className="dash-btn--sm" onClick={() => setForm(initialForm)} disabled={!dirty || state.status === "saving"}>Cancel</SecondaryButton>
          <button type="button" className="dash-btn dash-btn--primary dash-btn--sm" onClick={handleSave} disabled={!dirty || state.status === "saving"}>
            {state.status === "saving" ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

const STUDENT_SETTINGS_TABS = [
  { id: "profile", label: "Profile", icon: User, description: "Your account details" },
  { id: "notifications", label: "Notifications", icon: Bell, description: "Email and alerts" },
  { id: "calendar", label: "Calendar", icon: Calendar, description: "Meetings and reminders" },
  { id: "display", label: "Display", icon: Monitor, description: "Layout and accessibility" },
  { id: "integrations", label: "Connected accounts", icon: Link2, description: "Google and Zoom" },
  { id: "family", label: "Family", icon: Users, description: "Parents and guardians" },
  { id: "security", label: "Security", icon: Shield, description: "Password and deletion" },
  { id: "privacy", label: "Privacy & data", icon: Shield, description: "Visibility and data requests" },
  { id: "support", label: "Support", icon: HelpCircle, description: "Help and contact" }
];

const MENTOR_SETTINGS_TABS = [
  { id: "profile", label: "Profile", icon: User, description: "Mentor profile details" },
  { id: "integrations", label: "Connected accounts", icon: Link2, description: "Google and Zoom" },
  { id: "security", label: "Security", icon: Shield, description: "Password and deletion" },
  { id: "support", label: "Support", icon: HelpCircle, description: "Help and contact" }
];

const PARENT_SETTINGS_TABS = [
  { id: "profile", label: "Profile", icon: User, description: "Your account details" },
  { id: "notifications", label: "Notifications", icon: Bell, description: "Email and alerts" },
  { id: "calendar", label: "Calendar", icon: Calendar, description: "Meetings and reminders" },
  { id: "display", label: "Display", icon: Monitor, description: "Layout and accessibility" },
  { id: "integrations", label: "Connected accounts", icon: Link2, description: "Google and Zoom" },
  { id: "security", label: "Security", icon: Shield, description: "Password and deletion" },
  { id: "privacy", label: "Privacy & data", icon: Shield, description: "Visibility and data requests" },
  { id: "support", label: "Support", icon: HelpCircle, description: "Help and contact" }
];

const NOTIFICATION_PREF_KEYS = [
  "emailUpdates",
  "securityAlerts",
  "meetingReminders",
  "deadlineReminders",
  "mentorMessages",
  "weeklyDigest",
  "quietHoursEnabled",
  "quietHoursStart",
  "quietHoursEnd"
];

const DISPLAY_PREF_KEYS = ["density", "reduceMotion", "interfaceSounds", "hapticFeedback"];
const CALENDAR_PREF_KEYS = ["defaultCalendarView", "reminderLeadTime", "weekStart"];
const PRIVACY_PREF_KEYS = ["profileVisibility", "dataExportRequestedAt"];

function sectionDirty(current, initial, keys) {
  return keys.some((key) => current?.[key] !== initial?.[key]);
}

function renderSetting(setting, prefs, setPref) {
  if (setting.type === "select") {
    return (
      <SettingSelect
        key={setting.id}
        id={setting.id}
        label={setting.label}
        description={setting.description}
        value={prefs[setting.id]}
        onChange={(value) => setPref(setting.id, value)}
        options={setting.options}
      />
    );
  }
  return (
    <SettingToggle
      key={setting.id}
      id={setting.id}
      label={setting.label}
      description={setting.description}
      checked={Boolean(prefs[setting.id])}
      onChange={(value) => setPref(setting.id, value)}
    />
  );
}

function NotificationsSettingsSection({ role = "student", prefs, setPref, dirty, saveState, onSave }) {
  const groups = getNotificationGroups(role);
  return (
    <SectionCard title="Notifications" className="dash-panel dash-settings-card">
      <p className="dash-muted">A shorter notification setup: essentials, student progress, and quiet hours.</p>
      <div className="dash-settings-groups">
        {groups.map((group) => (
          <section key={group.id} className="dash-settings-group" aria-labelledby={`settings-group-${group.id}`}>
            <h4 id={`settings-group-${group.id}`}>{group.title}</h4>
            {group.items.map((item) => (
              <SettingToggle
                key={item.id}
                id={`${role}-${item.id}`}
                label={item.label}
                description={item.description}
                checked={Boolean(prefs[item.id])}
                onChange={(value) => setPref(item.id, value)}
              />
            ))}
            {group.id === "quiet" && prefs.quietHoursEnabled ? (
              <div className="dash-setting-row dash-setting-row--stacked">
                <div className="dash-setting-row__text">
                  <span className="dash-setting-row__label">Quiet hours window</span>
                  <p className="dash-setting-row__desc">Urgent security alerts still come through.</p>
                </div>
                <div className="dash-setting-row__inline">
                  <input className="dash-input" type="time" value={prefs.quietHoursStart} onChange={(e) => setPref("quietHoursStart", e.target.value)} aria-label="Quiet hours start" />
                  <span>to</span>
                  <input className="dash-input" type="time" value={prefs.quietHoursEnd} onChange={(e) => setPref("quietHoursEnd", e.target.value)} aria-label="Quiet hours end" />
                </div>
              </div>
            ) : null}
          </section>
        ))}
      </div>
      <SaveRow section="notifications" saveState={saveState} onSave={onSave} dirty={dirty} />
    </SectionCard>
  );
}

function DisplaySettingsSection({ prefs, setPref, dirty, saveState, onSave }) {
  return (
    <SectionCard title="Display &amp; accessibility" className="dash-panel dash-settings-card">
      <p className="dash-muted">Keep Prelude’s visual style and tune only the display controls that affect the dashboard.</p>
      <div className="dash-settings-groups">
        <section className="dash-settings-group">
          {getDisplaySettings().map((setting) => renderSetting(setting, prefs, setPref))}
        </section>
      </div>
      <SaveRow section="display" saveState={saveState} onSave={onSave} dirty={dirty} />
    </SectionCard>
  );
}

function ConnectedAccountsSection({ integrations, connectGoogle, disconnectGoogle, connectZoomAccount, disconnectZoomAccount, role = "student" }) {
  const cards = getIntegrationCards(integrations, { integrationsAvailable: false });
  const handlers = {
    googleCalendar: { onConnect: connectGoogle, onDisconnect: disconnectGoogle },
    zoom: { onConnect: connectZoomAccount, onDisconnect: disconnectZoomAccount }
  };
  return (
    <SectionCard title="Connected accounts" className="dash-panel dash-settings-card">
      <p className="dash-muted">
        Prelude currently supports meeting links inside calendars. Direct Google Calendar and Zoom account OAuth will appear here when setup is ready.
      </p>
      <div className="dash-integration-grid">
        {cards.map((card) => (
          <IntegrationConnect
            key={card.id}
            label={card.label}
            connectLabel={card.actionLabel}
            connected={card.connected}
            status={card.status}
            available={card.available}
            unavailableNote={card.unavailableNote}
            onConnect={handlers[card.id]?.onConnect}
            onDisconnect={handlers[card.id]?.onDisconnect}
            description={role === "parent" && card.id === "googleCalendar" ? "Keep family planning dates visible when calendar sync is enabled." : card.purpose}
          />
        ))}
      </div>
    </SectionCard>
  );
}

export function StudentSettingsPage() {
  const { user, planDetails, openAccount } = useAuth();
  const {
    integrations,
    connectGoogle,
    disconnectGoogle,
    connectZoomAccount,
    disconnectZoomAccount,
    savePreferences: savePrefsToBackend,
    saveProfile,
    useSupabaseData,
    preferences: loadedPreferences,
    profile
  } = useDashboardData();
  const [tab, setTab] = useState("profile");
  const [prefs, setPrefs] = useState(() => loadPreferences());
  const [initialPrefs, setInitialPrefs] = useState(() => loadPreferences());
  const [saveState, setSaveState] = useState(null);

  useEffect(() => {
    const hash = (window.location.hash || "").replace(/^#/, "");
    if (hash && STUDENT_SETTINGS_TABS.some((item) => item.id === hash)) {
      setTab(hash);
    }
  }, []);

  useEffect(() => {
    if (loadedPreferences) {
      const next = { ...loadPreferences(), ...loadedPreferences };
      setPrefs(next);
      setInitialPrefs(next);
    }
  }, [loadedPreferences]);

  const roleLabel = "Student";
  const planName = planDetails?.name || user?.planName || "Basic";

  function setPref(key, value) {
    setPrefs((current) => ({ ...current, [key]: value }));
  }

  async function saveSection(section) {
    setSaveState({ section, status: "saving", message: "" });
    try {
      if (useSupabaseData) {
        await savePrefsToBackend(prefs);
      }
      savePreferences(prefs);
      setInitialPrefs(prefs);
      setSaveState({ section, status: "saved", message: "" });
      window.setTimeout(() => setSaveState((current) => current?.section === section ? null : current), 2600);
    } catch (error) {
      setSaveState({
        section,
        status: "error",
        message: "We could not save those settings. Try again."
      });
    }
  }

  return (
    <SettingsPageShell
      user={user}
      profile={profile}
      roleLabel={roleLabel}
      planName={planName}
      tabs={STUDENT_SETTINGS_TABS}
      activeTab={tab}
      onTabChange={setTab}
      onOpenAccount={openAccount}
    >
      {tab === "profile" ? (
        <>
          <AccountSettingsPanel
            user={user}
            profile={profile}
            roleLabel={roleLabel}
            useSupabaseData={useSupabaseData}
            saveProfile={saveProfile}
          />
          <SectionCard
            title="Academic profile"
            className="dash-panel"
            action={
              <Link to={`${STUDENT_DASHBOARD_BASE}/profile-stats`} className="dash-btn dash-btn--secondary dash-btn--sm">
                <Pencil className="h-4 w-4" aria-hidden="true" /> Edit full profile
              </Link>
            }
          >
            <p className="dash-muted">Manage GPA, test scores, intended majors, college goals, activities, and essays from your academic profile.</p>
          </SectionCard>
        </>
      ) : null}

      {tab === "notifications" ? (
        <NotificationsSettingsSection
          role="student"
          prefs={prefs}
          setPref={setPref}
          dirty={sectionDirty(prefs, initialPrefs, NOTIFICATION_PREF_KEYS)}
          saveState={saveState}
          onSave={saveSection}
        />
      ) : null}

      {tab === "calendar" ? (
        <SectionCard title="Calendar &amp; meeting preferences" className="dash-panel">
          <SettingSelect
            id="defaultCalendarView"
            label="Default calendar view"
            description="The view your calendar opens in."
            value={prefs.defaultCalendarView}
            onChange={(v) => setPref("defaultCalendarView", v)}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "day", label: "Day" },
              { value: "agenda", label: "Agenda" }
            ]}
          />
          <SettingSelect
            id="reminderLeadTime"
            label="Meeting reminder"
            description="How far ahead to remind you about sessions."
            value={prefs.reminderLeadTime}
            onChange={(v) => setPref("reminderLeadTime", v)}
            options={[
              { value: "10", label: "10 minutes before" },
              { value: "30", label: "30 minutes before" },
              { value: "60", label: "1 hour before" },
              { value: "1440", label: "1 day before" }
            ]}
          />
          <SettingSelect
            id="weekStart"
            label="Week starts on"
            value={prefs.weekStart}
            onChange={(v) => setPref("weekStart", v)}
            options={[
              { value: "sunday", label: "Sunday" },
              { value: "monday", label: "Monday" }
            ]}
          />
          <SaveRow section="calendar" saveState={saveState} onSave={saveSection} dirty={sectionDirty(prefs, initialPrefs, CALENDAR_PREF_KEYS)} />
        </SectionCard>
      ) : null}

      {tab === "display" ? (
        <DisplaySettingsSection
          prefs={prefs}
          setPref={setPref}
          dirty={sectionDirty(prefs, initialPrefs, DISPLAY_PREF_KEYS)}
          saveState={saveState}
          onSave={saveSection}
        />
      ) : null}

      {tab === "integrations" ? (
        <ConnectedAccountsSection
          integrations={integrations}
          connectGoogle={connectGoogle}
          disconnectGoogle={disconnectGoogle}
          connectZoomAccount={connectZoomAccount}
          disconnectZoomAccount={disconnectZoomAccount}
        />
      ) : null}

      {tab === "family" ? <ParentGuardianSettingsPanel user={user} /> : null}

      {tab === "security" ? <SecuritySettingsPanel user={user} onOpenAccount={openAccount} /> : null}

      {tab === "privacy" ? (
        <SectionCard title="Privacy &amp; data" className="dash-panel">
          <SettingSelect
            id="profileVisibility"
            label="Profile visibility"
            description="Control who can see your college-planning profile inside Prelude."
            value={prefs.profileVisibility}
            onChange={(v) => setPref("profileVisibility", v)}
            options={[
              { value: "mentors_only", label: "Assigned mentors only" },
              { value: "parents_and_mentors", label: "Parents and assigned mentors" },
              { value: "private", label: "Private" }
            ]}
          />
          <div className="dash-setting-row">
            <div className="dash-setting-row__text">
              <span className="dash-setting-row__label">Download account data</span>
              <p className="dash-setting-row__desc">
                Request a privacy-safe export of your profile, settings, saved colleges, tasks, essays, scholarships, and activity.
              </p>
              {prefs.dataExportRequestedAt ? (
                <p className="dash-muted">Requested {new Date(prefs.dataExportRequestedAt).toLocaleString()}.</p>
              ) : null}
            </div>
            <SecondaryButton type="button" className="dash-btn--sm" onClick={() => setPref("dataExportRequestedAt", new Date().toISOString())}>
              Request export
            </SecondaryButton>
          </div>
          <p className="dash-muted">
            Account deletion and session revocation stay in Security so they can use the stricter confirmation flow.
          </p>
          <SaveRow section="privacy" saveState={saveState} onSave={saveSection} dirty={sectionDirty(prefs, initialPrefs, PRIVACY_PREF_KEYS)} />
        </SectionCard>
      ) : null}

      {tab === "support" ? (
        <SectionCard title="Support" className="dash-panel">
          <a className="dash-setting-link" href="mailto:preludesupport@preludeconsultingllc.com">
            <span>
              <span className="dash-setting-link__label"><Mail className="h-4 w-4" aria-hidden="true" /> Contact support</span>
              <span className="dash-setting-link__desc">preludesupport@preludeconsultingllc.com</span>
            </span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <button type="button" className="dash-setting-link" onClick={openAccount}>
            <span>
              <span className="dash-setting-link__label">Account &amp; plan</span>
              <span className="dash-setting-link__desc">View or change your subscription.</span>
            </span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </SectionCard>
      ) : null}
    </SettingsPageShell>
  );
}

export function MentorSettingsPage() {
  const { user, openAccount } = useAuth();
  const {
    integrations,
    connectGoogle,
    disconnectGoogle,
    connectZoomAccount,
    disconnectZoomAccount,
    saveProfile,
    useSupabaseData,
    profile
  } = useDashboardData();
  const [tab, setTab] = useState("profile");

  return (
    <SettingsPageShell
      user={user}
      profile={profile}
      roleLabel="Mentor"
      tabs={MENTOR_SETTINGS_TABS}
      activeTab={tab}
      onTabChange={setTab}
      onOpenAccount={openAccount}
      accountActionLabel="Account"
    >
      {tab === "profile" ? (
        <>
          <AccountSettingsPanel
            user={user}
            profile={profile}
            roleLabel="Mentor"
            useSupabaseData={useSupabaseData}
            saveProfile={saveProfile}
          />
          <MentorProfileSettingsPanel
            user={user}
            profile={profile}
            useSupabaseData={useSupabaseData}
            saveProfile={saveProfile}
          />
        </>
      ) : null}

      {tab === "integrations" ? (
        <ConnectedAccountsSection
          integrations={integrations}
          connectGoogle={connectGoogle}
          disconnectGoogle={disconnectGoogle}
          connectZoomAccount={connectZoomAccount}
          disconnectZoomAccount={disconnectZoomAccount}
          role="mentor"
        />
      ) : null}

      {tab === "security" ? <SecuritySettingsPanel user={user} onOpenAccount={openAccount} /> : null}

      {tab === "support" ? (
        <SectionCard title="Support" className="dash-panel">
          <a className="dash-setting-link" href="mailto:preludesupport@preludeconsultingllc.com">
            <span>
              <span className="dash-setting-link__label"><Mail className="h-4 w-4" aria-hidden="true" /> Contact support</span>
              <span className="dash-setting-link__desc">preludesupport@preludeconsultingllc.com</span>
            </span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </SectionCard>
      ) : null}
    </SettingsPageShell>
  );
}

export function ParentSettingsPage() {
  const { user, planDetails, openAccount } = useAuth();
  const {
    integrations,
    connectGoogle,
    disconnectGoogle,
    connectZoomAccount,
    disconnectZoomAccount,
    saveProfile,
    savePreferences: savePrefsToBackend,
    useSupabaseData,
    preferences: loadedPreferences,
    profile
  } = useDashboardData();
  const [tab, setTab] = useState("profile");
  const [prefs, setPrefs] = useState(() => loadPreferences());
  const [initialPrefs, setInitialPrefs] = useState(() => loadPreferences());
  const [saveState, setSaveState] = useState(null);
  const [linkedChildren, setLinkedChildren] = useState([]);
  const [childrenLoading, setChildrenLoading] = useState(true);

  useEffect(() => {
    const hash = (window.location.hash || "").replace(/^#/, "");
    if (hash && PARENT_SETTINGS_TABS.some((item) => item.id === hash)) {
      setTab(hash);
    }
  }, []);

  useEffect(() => {
    if (loadedPreferences) {
      const next = { ...loadPreferences(), ...loadedPreferences };
      setPrefs(next);
      setInitialPrefs(next);
    }
  }, [loadedPreferences]);

  useEffect(() => {
    let cancelled = false;
    async function loadChildren() {
      if (!user?.id) {
        setLinkedChildren([]);
        setChildrenLoading(false);
        return;
      }
      setChildrenLoading(true);
      try {
        if (shouldUseDemoFixtures(user)) {
          if (!cancelled) setLinkedChildren(getDemoLinkedChildren());
          return;
        }
        const rows = await listLinkedChildren(user.id);
        if (!cancelled) setLinkedChildren(rows);
      } finally {
        if (!cancelled) setChildrenLoading(false);
      }
    }
    loadChildren();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const roleLabel = "Parent";
  const planName = planDetails?.name || user?.planName || "Basic";

  function setPref(key, value) {
    setPrefs((current) => ({ ...current, [key]: value }));
  }

  async function saveSection(section) {
    setSaveState({ section, status: "saving", message: "" });
    try {
      if (useSupabaseData) {
        await savePrefsToBackend(prefs);
      }
      savePreferences(prefs);
      setInitialPrefs(prefs);
      setSaveState({ section, status: "saved", message: "" });
      window.setTimeout(() => setSaveState((current) => current?.section === section ? null : current), 2600);
    } catch (error) {
      setSaveState({
        section,
        status: "error",
        message: "We could not save those settings. Try again."
      });
    }
  }

  return (
    <SettingsPageShell
      user={user}
      profile={profile}
      roleLabel={roleLabel}
      planName={planName}
      tabs={PARENT_SETTINGS_TABS}
      activeTab={tab}
      onTabChange={setTab}
      onOpenAccount={openAccount}
    >
      {tab === "profile" ? (
        <>
          <AccountSettingsPanel
            user={user}
            profile={profile}
            roleLabel={roleLabel}
            useSupabaseData={useSupabaseData}
            saveProfile={saveProfile}
          />

          <SectionCard
            title="Linked children"
            className="dash-panel"
            action={
              <Link to={`${PARENT_DASHBOARD_BASE}/overview`} className="dash-btn dash-btn--secondary dash-btn--sm">
                <Users className="h-4 w-4" aria-hidden="true" /> View children
              </Link>
            }
          >
            {childrenLoading ? (
              <p className="dash-muted" role="status" aria-live="polite">Loading linked children…</p>
            ) : null}
            {!childrenLoading && !linkedChildren.length ? (
              <p className="dash-muted">
                No children linked yet. Ask your student to add your email during sign-up or invite you from Prelude Settings → Family.
              </p>
            ) : null}
            {!childrenLoading && linkedChildren.length ? (
              <ul className="dash-parent-invite-list">
                {linkedChildren.map((child) => (
                  <li key={child.id} className="dash-parent-invite-list__item">
                    <span>{child.name}</span>
                    <span className="dash-muted">{child.grade || "Student"}</span>
                    <Link
                      to={`${PARENT_DASHBOARD_BASE}/children/${child.id}/overview`}
                      className="dash-btn dash-btn--secondary dash-btn--sm"
                    >
                      Open dashboard
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </SectionCard>
        </>
      ) : null}

      {tab === "notifications" ? (
        <NotificationsSettingsSection
          role="parent"
          prefs={prefs}
          setPref={setPref}
          dirty={sectionDirty(prefs, initialPrefs, NOTIFICATION_PREF_KEYS)}
          saveState={saveState}
          onSave={saveSection}
        />
      ) : null}

      {tab === "calendar" ? (
        <SectionCard title="Calendar &amp; meeting preferences" className="dash-panel">
          <SettingSelect
            id="defaultCalendarView"
            label="Default calendar view"
            description="The view your calendar opens in when viewing a child."
            value={prefs.defaultCalendarView}
            onChange={(v) => setPref("defaultCalendarView", v)}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "day", label: "Day" },
              { value: "agenda", label: "Agenda" }
            ]}
          />
          <SettingSelect
            id="reminderLeadTime"
            label="Meeting reminder"
            description="How far ahead to remind you about your children's sessions."
            value={prefs.reminderLeadTime}
            onChange={(v) => setPref("reminderLeadTime", v)}
            options={[
              { value: "10", label: "10 minutes before" },
              { value: "30", label: "30 minutes before" },
              { value: "60", label: "1 hour before" },
              { value: "1440", label: "1 day before" }
            ]}
          />
          <SettingSelect
            id="weekStart"
            label="Week starts on"
            value={prefs.weekStart}
            onChange={(v) => setPref("weekStart", v)}
            options={[
              { value: "sunday", label: "Sunday" },
              { value: "monday", label: "Monday" }
            ]}
          />
          <SaveRow section="calendar" saveState={saveState} onSave={saveSection} dirty={sectionDirty(prefs, initialPrefs, CALENDAR_PREF_KEYS)} />
        </SectionCard>
      ) : null}

      {tab === "display" ? (
        <DisplaySettingsSection
          prefs={prefs}
          setPref={setPref}
          dirty={sectionDirty(prefs, initialPrefs, DISPLAY_PREF_KEYS)}
          saveState={saveState}
          onSave={saveSection}
        />
      ) : null}

      {tab === "integrations" ? (
        <ConnectedAccountsSection
          integrations={integrations}
          connectGoogle={connectGoogle}
          disconnectGoogle={disconnectGoogle}
          connectZoomAccount={connectZoomAccount}
          disconnectZoomAccount={disconnectZoomAccount}
          role="parent"
        />
      ) : null}

      {tab === "security" ? <SecuritySettingsPanel user={user} onOpenAccount={openAccount} /> : null}

      {tab === "support" ? (
        <SectionCard title="Support" className="dash-panel">
          <a className="dash-setting-link" href="mailto:preludesupport@preludeconsultingllc.com">
            <span>
              <span className="dash-setting-link__label"><Mail className="h-4 w-4" aria-hidden="true" /> Contact support</span>
              <span className="dash-setting-link__desc">preludesupport@preludeconsultingllc.com</span>
            </span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <Link className="dash-setting-link" to={`${PARENT_DASHBOARD_BASE}/help`}>
            <span>
              <span className="dash-setting-link__label">Help center</span>
              <span className="dash-setting-link__desc">Common questions for parent accounts.</span>
            </span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button type="button" className="dash-setting-link" onClick={openAccount}>
            <span>
              <span className="dash-setting-link__label">Account &amp; plan</span>
              <span className="dash-setting-link__desc">View or change your subscription.</span>
            </span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </SectionCard>
      ) : null}
    </SettingsPageShell>
  );
}

/** @deprecated Use StudentSettingsPage */
export const StudentProfileSettings = StudentSettingsPage;

/** @deprecated Use MentorSettingsPage */
export const MentorProfileSettings = MentorSettingsPage;
