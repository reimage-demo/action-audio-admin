// Shared question definitions keep customer intake and staff records in agreement.
const question = (id, label, options) => ({
  id,
  label,
  options: [...options, "Not sure — please advise"],
});
const equipment = question("equipment", "Do you already have the equipment?", [
  "Please supply equipment and installation",
  "I have equipment to install",
]);
const audio = [
  question("scope", "What would you like to upgrade?", [
    "Stereo / touchscreen receiver",
    "Speakers",
    "Subwoofer / amplifier",
    "Complete sound system",
  ]),
  equipment,
];
export const estimateQuestions = {
  "car-audio": audio,
  "remote-starters": [
    question("ignition", "How do you start your vehicle?", [
      "Key ignition",
      "Push-button start",
    ]),
    question("transmission", "Transmission", ["Automatic", "Manual"]),
    question("control", "How would you like to control it?", [
      "Remote / key fob",
      "Phone app",
      "Both remote and phone",
    ]),
  ],
  "auto-detailing": [
    question("scope", "Which areas need detailing?", [
      "Interior",
      "Exterior",
      "Interior and exterior",
    ]),
    question("condition", "How would you describe its condition?", [
      "Light cleaning / regular upkeep",
      "Heavy dirt or stains",
      "Pet hair or odors",
      "Paint or surface concerns",
    ]),
  ],
  "window-tinting": [
    question("coverage", "Which windows would you like tinted?", [
      "Front side windows",
      "All side windows and rear window",
      "Other coverage — describe below",
    ]),
    question("existingTint", "Is there tint on these windows now?", [
      "No existing tint",
      "Existing tint needs removal",
      "Existing tint — unsure about removal",
    ]),
  ],
  "dash-cams": [
    question("coverage", "Which camera views do you want?", [
      "Front only",
      "Front and rear",
      "Front and cabin",
      "Front, rear, and cabin",
    ]),
    question("parking", "Recording while parked?", ["Yes", "No"]),
    equipment,
  ],
  "gps-trackers": [
    question("vehicles", "How many vehicles need a tracker?", [
      "One vehicle",
      "Multiple vehicles — describe below",
    ]),
    equipment,
  ],
  "electronics-replacement": [
    question("scope", "What needs replacing?", [
      "Stereo / receiver",
      "Speakers / amplifier / subwoofer",
      "Other electronics — describe below",
    ]),
    equipment,
  ],
  "car-alarms": [
    question("scope", "Which features are you interested in?", [
      "Alarm / security",
      "Keyless entry",
      "Alarm with remote start",
    ]),
    equipment,
  ],
  "motorcycle-audio": audio,
  "video-systems": [
    question("scope", "Which screens are you interested in?", [
      "Dashboard receiver",
      "Rear-seat screens",
      "Overhead screen",
    ]),
    equipment,
  ],
  "power-liftgates": [
    question("liftgate", "What type of liftgate do you have now?", [
      "Manual liftgate",
      "Powered liftgate",
    ]),
    equipment,
  ],
  "vehicle-accessories": [equipment],
  "electrical-installation": [equipment],
};
export const detailPrompts = {
  "auto-detailing":
    "Tell us about stains, pet hair, odors, or areas that need extra attention.",
  "window-tinting":
    "Tell us your preferred look or film, any damaged tint, and any other windows you have in mind.",
  "remote-starters":
    "Share the trim, number of working keys, and any existing remote starter or alarm, if known.",
  "dash-cams":
    "Share the camera brand/model if you have one, or tell us what you want from your new setup.",
  "gps-trackers":
    "Share the tracker brand/model if known, features you need, and details of any additional vehicles.",
};
export const defaultDetailPrompt =
  "Tell us what you want to change, your current setup, and any equipment brand/model numbers you know.";
