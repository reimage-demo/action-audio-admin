// Public service information. Booking IDs retain the existing backend categories.
export const serviceContent = [
  {
    id: "car-audio",
    name: "Car audio",
    tag: "Hear the difference",
    headline: "Your music.\nA whole new feeling.",
    description:
      "Clearer vocals. Fuller bass. The songs you know, with the details you’ve been missing. Build a sound system around your vehicle and the way you listen.",
    image: "hero-installation.webp",
    alt: "Illustrative speaker and amplifier installation in a vehicle",
    booking: "electrical-installation",
    category: "Car audio",
    items: [
      "Speaker upgrades and component systems",
      "Subwoofers, enclosures, and amplifiers",
      "Touchscreen receivers and factory-system integration",
    ],
    detail:
      "A great system starts with the right combination of equipment. Tell us what you listen to, what you like about your current setup, and what you want to improve. We’ll discuss speaker fit, available space, power needs, and how to retain the factory features you use.",
    prepare:
      "Bring your vehicle’s year, make, and model, plus the model numbers of any equipment you already own.",
    faq: [
      [
        "Can I keep my factory radio?",
        "In many vehicles, an audio upgrade can work with the existing radio. The approach depends on your factory system, so we’ll review compatibility before recommending equipment.",
      ],
      [
        "Do I need a whole new system?",
        "Not necessarily. Share what you’d like to improve and we can discuss a focused upgrade or a complete system.",
      ],
    ],
  },
  {
    id: "remote-starters",
    name: "Remote starters",
    tag: "Comfort starts here",
    headline: "A better start.\nBefore you step inside.",
    description:
      "Make cold mornings and hot afternoons more comfortable. Explore a remote-start setup that fits your vehicle and your everyday routine.",
    image: "hero-remote-start.webp",
    alt: "Illustrative remote-start key fob in front of a silver SUV",
    booking: "electrical-installation",
    category: "Remote starters",
    items: [
      "Vehicle and factory-key compatibility review",
      "Remote range and control options",
      "Installation planning and system walkthrough",
    ],
    detail:
      "The right remote starter depends on your vehicle’s ignition, security system, and the range you need. Our team can discuss compatible options and any additional integration hardware before an installation is scheduled.",
    prepare:
      "Have your year, make, model, transmission type, and number of working keys ready. Ask the team which keys to bring to your appointment.",
    faq: [
      [
        "Will it work with my vehicle?",
        "Compatibility varies by vehicle, transmission, ignition, and factory security system. Contact us with your vehicle details before choosing a starter.",
      ],
      [
        "Can I start my car from my phone?",
        "Some systems offer smartphone control through additional hardware and a connected service. Ask about compatible options and any recurring fees.",
      ],
    ],
  },
  {
    id: "car-alarms",
    name: "Car alarms & security",
    tag: "A little more peace of mind",
    headline: "More confidence.\nWherever you park.",
    description:
      "Explore vehicle security options, from alarm systems to convenient keyless entry. Start with a conversation about your vehicle and what you want to protect.",
    image: "hero-remote-start.webp",
    alt: "Remote key fob beside a parked vehicle",
    booking: "electrical-installation",
    category: "Security",
    items: [
      "Alarm and keyless-entry options",
      "Factory security compatibility",
      "Sensor and remote-control options",
    ],
    detail:
      "A security system should fit the way you use your vehicle. We’ll discuss the features you need and how an aftermarket system may work with your existing locks, keys, and factory electronics.",
    prepare:
      "Tell us about your existing alarm or remote starter and any issues you are experiencing.",
    faq: [
      [
        "Can security and remote start work together?",
        "Some systems combine both. Compatibility and integration needs must be checked for your particular vehicle.",
      ],
    ],
  },
  {
    id: "motorcycle-audio",
    name: "Motorcycle audio",
    tag: "Sound for the open road",
    headline: "Take your soundtrack.\nBeyond the daily drive.",
    description:
      "Explore audio options for your motorcycle. Talk with our team about a setup suited to your bike, available space, and listening preferences.",
    image: "products/alpine-s2-s65.webp",
    product: true,
    alt: "Speaker example; motorcycle compatibility must be confirmed",
    booking: "electrical-installation",
    category: "Motorcycle audio",
    items: [
      "Motorcycle-specific fit and equipment review",
      "Speaker and amplifier options",
      "Weather exposure and power considerations",
    ],
    detail:
      "Motorcycle installations have different space, mounting, and environmental requirements from car systems. Ask the team to confirm service availability and suitable equipment for your specific bike.",
    prepare:
      "Share your motorcycle’s year, make, model, and existing audio equipment.",
    faq: [
      [
        "Can any car speaker go on a motorcycle?",
        "No. Fit, mounting, weather exposure, and electrical requirements need to be considered. Confirm a suitable setup before purchasing equipment.",
      ],
    ],
  },
  {
    id: "video-systems",
    name: "Video & entertainment",
    tag: "More ways to enjoy the ride",
    headline: "Make the back seat.\nThe best seat.",
    description:
      "Explore seatback and overhead video options for passengers, along with receivers that bring modern connectivity to the dashboard.",
    image: "products/kenwood-dmx4707s.webp",
    product: true,
    alt: "Kenwood touchscreen receiver example",
    booking: "electrical-installation",
    category: "Video systems",
    items: [
      "Seatback and drop-down video inquiries",
      "Touchscreen receiver options",
      "Source, power, and mounting compatibility",
    ],
    detail:
      "Screen placement and vehicle compatibility matter. Tell us who will use the system, the devices you want to connect, and the type of entertainment you have in mind. Our team can confirm available options and installation requirements.",
    prepare:
      "Bring vehicle details and information about the phones, streaming devices, or media sources you plan to use.",
    faq: [
      [
        "Can I add Apple CarPlay or Android Auto?",
        "Compatible aftermarket receivers may support these features. Vehicle fit, phone compatibility, and wired or wireless support depend on the receiver.",
      ],
    ],
  },
  {
    id: "power-liftgates",
    name: "Power liftgates",
    tag: "Everyday convenience",
    headline: "A little lift.\nA lot of convenience.",
    description:
      "Interested in adding powered access to your cargo area? Ask our team about vehicle-specific liftgate options and installation availability.",
    image: "hero-remote-start.webp",
    alt: "Silver SUV with remote key fob",
    booking: "electrical-installation",
    category: "Power liftgates",
    items: [
      "Vehicle-specific kit availability",
      "Control and opening-height options",
      "Installation and compatibility consultation",
    ],
    detail:
      "Power liftgate systems are vehicle-specific. The first step is checking whether a suitable kit exists for your exact vehicle and what modifications it requires. Our team will confirm available service options before you book installation.",
    prepare:
      "Share your year, make, model, and trim, and whether your liftgate is currently manual or powered.",
    faq: [
      [
        "Is every SUV compatible?",
        "No. Kit availability and installation requirements vary by vehicle and trim. Contact us for a compatibility review.",
      ],
    ],
  },
  {
    id: "radar-detectors",
    name: "Radar detectors",
    tag: "A considered installation",
    headline: "Less clutter.\nA cleaner setup.",
    description:
      "Explore detector mounting and power options for a tidy interior. Ask about equipment compatibility and installation availability for your vehicle.",
    image: "hero-interior.webp",
    alt: "Clean vehicle interior with integrated electronics",
    booking: "electrical-installation",
    category: "Radar detectors",
    items: [
      "Mounting and placement consultation",
      "Compatible power and cable-routing options",
      "Equipment and vehicle fit review",
    ],
    detail:
      "Share the detector model you have or the type of setup you are considering. We can discuss placement, wiring, and whether the equipment can be integrated into your vehicle.",
    prepare:
      "Bring the equipment model and accessories, if you already own a detector.",
    faq: [
      [
        "Can you help with equipment I already own?",
        "Contact the team with its make and model so we can review the installation requirements and confirm service availability.",
      ],
    ],
  },
  {
    id: "vehicle-accessories",
    name: "Connected accessories",
    tag: "Small upgrades. Everyday impact.",
    headline: "Your car.\nMore connected.",
    description:
      "Explore convenient additions such as smartphone integration, satellite radio, and garage-door controls. Find out what works with your existing electronics.",
    image: "hero-interior.webp",
    alt: "Vehicle dashboard and door speaker",
    booking: "electrical-installation",
    category: "Accessories",
    items: [
      "Satellite radio and SiriusXM integration inquiries",
      "HomeLink and convenience accessory inquiries",
      "Factory system and receiver compatibility",
    ],
    detail:
      "An accessory should feel like it belongs in your vehicle. Tell us what you want to add and we’ll review equipment compatibility, available installation options, and any required subscriptions or adapters.",
    prepare:
      "Share vehicle details and the model of your factory or aftermarket receiver.",
    faq: [
      [
        "Does a new accessory require a new radio?",
        "It depends on the accessory and your current system. Some use adapters; others need a compatible receiver. We’ll help you understand the options.",
      ],
    ],
  },
  {
    id: "electronics-repair",
    name: "Electronics repair",
    tag: "Back to the way it should be",
    headline: "Less troubleshooting.\nMore enjoying the drive.",
    description:
      "Audio cutting out? A receiver that won’t respond? Tell us what’s happening so we can assess the issue and discuss the next step.",
    image: "hero-installation.webp",
    alt: "Illustrative technician working on vehicle audio equipment",
    booking: "electronics-repair",
    items: [
      "Vehicle electronics assessment",
      "Existing equipment and connection review",
      "Repair options discussed before work proceeds",
    ],
    detail:
      "Describe when the problem started, whether it is intermittent, and any recent changes to the vehicle or equipment. That helps the team understand the symptoms and plan an assessment.",
    prepare:
      "Bring equipment model numbers, any relevant installation records, and a description or video of intermittent symptoms.",
    faq: [
      [
        "Can you quote a repair before seeing the vehicle?",
        "Some issues need an in-person assessment. Contact us with the symptoms so the team can explain the next step and any assessment charges.",
      ],
    ],
  },
  {
    id: "auto-detailing",
    name: "Auto detailing",
    tag: "A fresh perspective",
    headline: "Fall in love.\nWith your ride again.",
    description:
      "Give your vehicle some extra care. Talk with us about its current condition and the interior or exterior finish you have in mind.",
    image: "hero-interior.webp",
    alt: "Clean leather vehicle interior",
    booking: "auto-detailing",
    items: [
      "A conversation about your vehicle’s condition",
      "Detailing scope tailored to your needs",
      "Scheduling and care recommendations",
    ],
    detail:
      "Every vehicle arrives with a different story. Tell us which areas need attention, from daily wear to a refresh before a special occasion. The team will confirm the available detailing services and scope with you.",
    prepare:
      "Mention stains, sensitive surfaces, or specific areas of concern. Ask the team how to prepare your vehicle before drop-off.",
    faq: [
      [
        "How long will detailing take?",
        "Timing depends on the vehicle’s condition and the agreed scope. The team will discuss a schedule when confirming your appointment.",
      ],
    ],
  },
  {
    id: "electrical-installation",
    name: "Electrical installation",
    tag: "Bring your next project",
    headline: "The right equipment.\nThoughtfully installed.",
    description:
      "Plan your next vehicle electronics project with Action Audio. We’ll discuss your equipment, check compatibility, and help you understand the installation.",
    image: "hero-installation.webp",
    alt: "Illustrative car audio installation",
    booking: "electrical-installation",
    items: [
      "Equipment and vehicle compatibility",
      "Installation planning and cable routing",
      "A walkthrough of your new setup",
    ],
    detail:
      "From an aftermarket receiver to a more involved electronics upgrade, the details start with your vehicle and the equipment you choose. Contact the team to discuss the project before purchasing parts.",
    prepare:
      "Have your vehicle details and equipment model numbers ready, including any adapters or accessories you already have.",
    faq: [
      [
        "Can I bring my own equipment?",
        "Ask the team first. We’ll review the model, condition, and required installation parts before confirming the work.",
      ],
    ],
  },
];
export const electronicsCategories = [
  "Car audio",
  "Remote starters",
  "Security",
  "Motorcycle audio",
  "Video systems",
  "Power liftgates",
  "Radar detectors",
  "Accessories",
];
