import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { es, USERS_INDEX, EVENTS_INDEX, indexEvent, indexUser } from "@acme/es";

const db = new PrismaClient();

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const FIRST_NAMES = [
  "Liam",
  "Noah",
  "Oliver",
  "James",
  "Elijah",
  "William",
  "Henry",
  "Lucas",
  "Benjamin",
  "Theodore",
  "Olivia",
  "Emma",
  "Charlotte",
  "Amelia",
  "Sophia",
  "Mia",
  "Isabella",
  "Ava",
  "Evelyn",
  "Luna",
  "Ethan",
  "Mason",
  "Logan",
  "Alexander",
  "Sebastian",
  "Jack",
  "Aiden",
  "Owen",
  "Samuel",
  "Ryan",
  "Harper",
  "Scarlett",
  "Aria",
  "Penelope",
  "Layla",
  "Chloe",
  "Riley",
  "Zoey",
  "Nora",
  "Lily",
];

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
];

const UNIVERSITIES = [
  "Monash University",
  "University of Melbourne",
  "RMIT University",
  "Deakin University",
  "Swinburne University of Technology",
  "La Trobe University",
];

const UNIT_CODES_BY_UNI: Record<string, string[]> = {
  "Monash University": [
    "FIT1045",
    "FIT1047",
    "FIT2004",
    "FIT2014",
    "FIT2099",
    "FIT3171",
    "FIT3155",
    "FIT3077",
    "FIT3170",
    "MAT1830",
    "ENG1005",
    "FIT1008",
    "FIT2081",
    "FIT3143",
    "FIT3161",
  ],
  "University of Melbourne": [
    "COMP10001",
    "COMP10002",
    "COMP20003",
    "COMP20007",
    "COMP30020",
    "COMP30023",
    "SWEN20003",
    "SWEN30006",
    "INFO20003",
    "MAST10007",
    "MAST20026",
    "COMP30024",
    "COMP90038",
    "COMP90049",
    "SWEN90016",
  ],
  "RMIT University": [
    "COSC1076",
    "COSC1114",
    "COSC2299",
    "COSC2531",
    "ISYS1118",
    "COSC2123",
    "COSC2500",
    "COSC2673",
    "ISYS3413",
    "MATH1142",
    "COSC2636",
    "COSC2803",
    "ISYS1055",
    "COSC2758",
    "COSC2759",
  ],
  "Deakin University": [
    "SIT102",
    "SIT103",
    "SIT104",
    "SIT202",
    "SIT206",
    "SIT210",
    "SIT221",
    "SIT305",
    "SIT313",
    "SIT374",
    "SIT120",
    "SIT153",
    "SIT232",
    "SIT316",
    "SIT378",
  ],
  "Swinburne University of Technology": [
    "COS10009",
    "COS10011",
    "COS20007",
    "COS20015",
    "COS30008",
    "COS30015",
    "COS30043",
    "COS30049",
    "INF10003",
    "INF20012",
    "COS20019",
    "COS30041",
    "COS40003",
    "INF30029",
    "COS40005",
  ],
  "La Trobe University": [
    "CSE1OFX",
    "CSE1PGX",
    "CSE2DCX",
    "CSE2CNX",
    "CSE2ALX",
    "CSE3PAX",
    "CSE3PBX",
    "CSE3OSA",
    "CSE3DBX",
    "MAT1CLA",
    "CSE1ITX",
    "CSE2SAX",
    "CSE3AGX",
    "CSE3WSX",
    "CSE3CAX",
  ],
};

const AVATAR_URLS = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1542206395-9feb3edaa68d?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1502323777036-f29e3972d82f?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1557862921-37829c790f19?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1586297135537-94bc9ba060aa?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1546961342-ea5f71b193f3?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1523477800337-966dbabe060b?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1506863530036-1efeddceb993?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=400&h=400&fit=crop&crop=face",
];

const BANNER_URLS = [
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1515879218367-8466d910auj7?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1555099962-4199c345e5dd?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1573167243872-43c6433b9d40?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1558008258-3256797b43f3?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=400&fit=crop",
];

const EVENT_BANNER_URLS = [
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1591115765373-5207764f72e7?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1555099962-4199c345e5dd?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1573167243872-43c6433b9d40?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1558008258-3256797b43f3?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1587825140708-dfaf18c4303d?w=1200&h=600&fit=crop",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=600&fit=crop",
];

const BIOS = [
  "CS student passionate about building things that matter.",
  "Full-stack dev in the making. Currently deep into React & TypeScript.",
  "Third year IT student. Love hackathons and late-night coding sessions.",
  "Aspiring ML engineer. Python is my first language (literally).",
  "Design meets code. I care about the pixels as much as the logic.",
  "Backend enthusiast. Databases, APIs, and distributed systems.",
  "Cybersecurity student trying to break (and fix) everything.",
  "Mobile dev nerd. SwiftUI by day, Flutter by night.",
  "Open source contributor. Linux user since high school.",
  "Game dev student. Unity, Unreal, and everything in between.",
  "Data science undergrad. Pandas > Excel, fight me.",
  "DevOps curious. Docker, Kubernetes, and CI/CD pipelines excite me.",
  "First year student figuring things out. Open to opportunities!",
  "Embedded systems enthusiast. I talk to hardware.",
  "Web accessibility advocate. The internet should work for everyone.",
  "Cloud computing student. AWS certified and Azure curious.",
  "AI/ML researcher. Working on NLP projects in my spare time.",
  "UX researcher who also codes. Best of both worlds.",
  "Networking student. Packets are my love language.",
  null,
  null,
  null,
];

const EVENT_TITLES = [
  "Intro to Web Development Workshop",
  "Data Structures & Algorithms Study Group",
  "Hackathon: Build in 24 Hours",
  "Career Fair 2026",
  "Machine Learning Paper Reading Club",
  "React Native Meetup",
  "Cloud Computing Workshop",
  "Cybersecurity CTF Night",
  "Open Source Contribution Sprint",
  "Tech Interview Prep Session",
  "Database Design Masterclass",
  "Mobile App Development Bootcamp",
  "DevOps & CI/CD Pipeline Workshop",
  "AI Ethics Panel Discussion",
  "Startup Pitch Night",
  "Competitive Programming Contest",
  "UI/UX Design Thinking Workshop",
  "Blockchain & Web3 Introduction",
  "Python for Data Analysis Workshop",
  "Networking Social Mixer",
  "Resume & Portfolio Review Session",
  "System Design Study Circle",
  "Game Development Jam",
  "Quantum Computing Talk",
  "Linux & Open Source Fest",
];

const EVENT_LOCATIONS = [
  "Engineering Building, Room 201",
  "Library Collaborative Space",
  "Student Union, Level 3",
  "Science Lecture Theatre A",
  "Innovation Hub, Ground Floor",
  "Campus Lawn (outdoor)",
  "Computing Lab C4.05",
  "Auditorium B",
  "Maker Space",
  "Online (Zoom)",
  "Coffee House on Campus",
  "Sports Pavilion Function Room",
  "Postgraduate Lounge",
  "Entrepreneurship Centre",
  "Design Studio, Building 5",
];

const EVENT_DESCRIPTIONS = [
  "Join us for a hands-on workshop where we'll build a full-stack web application from scratch. Perfect for beginners!",
  "Weekly study group focusing on common data structures and algorithm patterns. Bring your laptop and questions.",
  "24-hour hackathon open to all skill levels. Form teams, build something amazing, and win prizes!",
  "Meet recruiters and hiring managers from top tech companies. Bring your resume and your A-game.",
  "We'll read and discuss a recent ML paper each session. No prior ML experience needed, just curiosity.",
  "Casual meetup for React Native developers. Share projects, tips, and grab some pizza.",
  "Learn how to deploy applications on AWS and Google Cloud. We'll cover serverless, containers, and more.",
  "Test your cybersecurity skills in a Capture The Flag competition. Beginners and experts welcome.",
  "Let's contribute to open source projects together. We'll help you make your first PR!",
  "Practice technical interviews with peers. We'll cover coding, system design, and behavioral questions.",
  "Deep dive into relational database design, normalization, and query optimization.",
  "Two-day bootcamp covering iOS and Android development with React Native and Expo.",
  "Set up automated testing, continuous integration, and deployment pipelines for your projects.",
  "Panel discussion on the ethical implications of AI in society. Featuring professors and industry experts.",
  "Pitch your startup idea to a panel of investors and mentors. Get feedback and make connections.",
  "Weekly competitive programming practice. Solve problems from Codeforces, LeetCode, and more.",
  "Learn design thinking methodology and apply it to real-world UX problems.",
  "Introduction to blockchain technology, smart contracts, and decentralized applications.",
  "Hands-on workshop using Python, Pandas, and Matplotlib for data analysis and visualization.",
  "Casual networking event for CS and IT students. Meet peers from different years and specializations.",
  "Get feedback on your resume and portfolio from industry professionals and career advisors.",
  "Weekly study circle covering system design concepts. Great prep for senior dev interviews.",
  "48-hour game jam! Design, develop, and ship a game. Solo or team entries welcome.",
  "Guest lecture on quantum computing fundamentals and its potential impact on cryptography.",
  "Celebrate open source with lightning talks, demos, and a Linux install fest.",
];

const MESSAGE_TEMPLATES = [
  "Hey! I saw we're in the same unit. Want to study together sometime?",
  "Nice meeting you at the event! Let's stay in touch.",
  "Do you have the notes from last week's lecture?",
  "Want to team up for the group project?",
  "Thanks for the help with the assignment!",
  "Are you going to the hackathon this weekend?",
  "Just saw your project on GitHub, really impressive work!",
  "Hey, are you free to grab coffee and chat about the course?",
  "I'm starting a study group for the exam, interested?",
  "Great presentation today! Would love to learn more about your approach.",
  "Have you started the assignment yet? I'm stuck on question 3.",
  "Congrats on winning the coding competition!",
  "Would you be interested in working on a side project together?",
  "Hey! I noticed we share some enrolled units. Small world!",
  "Thanks for sharing those resources in the group chat.",
];

async function main() {
  console.log("Preserving real users, clearing seed data...");

  const realUsers = await db.user.findMany({
    where: { accounts: { some: {} } },
    select: { id: true, name: true, email: true },
  });
  const realUserIds = new Set(realUsers.map((u) => u.id));
  console.log(`  Found ${realUsers.length} real user(s) to preserve`);

  await db.$transaction([
    db.message.deleteMany({ where: { sender: { accounts: { none: {} } } } }),
    db.connectionRequest.deleteMany({
      where: {
        AND: [
          { senderId: { notIn: [...realUserIds] } },
          { receiverId: { notIn: [...realUserIds] } },
        ],
      },
    }),
    db.eventCheckIn.deleteMany({ where: { userId: { notIn: [...realUserIds] } } }),
    db.event.deleteMany({
      where: {
        organisers: { none: { id: { in: [...realUserIds] } } },
      },
    }),
    db.user.deleteMany({ where: { accounts: { none: {} } } }),
  ]);

  if (es) {
    console.log("Clearing Elasticsearch indices...");
    const indices = [USERS_INDEX, EVENTS_INDEX];
    for (const index of indices) {
      const exists = await es.indices.exists({ index });
      if (exists) {
        await es.deleteByQuery({
          index,
          body: { query: { match_all: {} } },
          refresh: true,
        });
        console.log(`  Cleared index "${index}"`);
      }
    }
  } else {
    console.warn("Elasticsearch client not available – skipping ES cleanup");
  }

  console.log("Seeding users...");

  const usedEmails = new Set<string>();
  const usedSlugs = new Set<string>();
  const now = new Date();

  const users = Array.from({ length: 40 }, (_, userIndex) => {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const name = `${firstName} ${lastName}`;

    let email: string;
    do {
      const suffix = randomInt(1, 999);
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${suffix}@email.com`;
    } while (usedEmails.has(email));
    usedEmails.add(email);

    let slug: string;
    do {
      const suffix = randomInt(1, 9999);
      slug = `${firstName.toLowerCase()}${lastName.toLowerCase()}${suffix}`;
    } while (usedSlugs.has(slug));
    usedSlugs.add(slug);

    const university = pick(UNIVERSITIES);
    const unitPool = UNIT_CODES_BY_UNI[university]!;
    const numUnits = randomInt(2, 5);
    const enrolledUnits = pickN(unitPool, numUnits).map((code) => ({
      code,
      university,
    }));

    const hasSocials = Math.random() > 0.3;
    const socials = hasSocials
      ? {
          githubUrl: Math.random() > 0.3 ? `https://github.com/${slug}` : null,
          linkedInUrl:
            Math.random() > 0.4 ? `https://linkedin.com/in/${slug}` : null,
          discordUsername:
            Math.random() > 0.5
              ? `${firstName.toLowerCase()}#${randomInt(1000, 9999)}`
              : null,
        }
      : null;

    const createdAt = randomDate(
      new Date(now.getFullYear(), now.getMonth() - 6, 1),
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
    );

    const avatarUrl = AVATAR_URLS[userIndex % AVATAR_URLS.length]!;
    const hasBanner = Math.random() > 0.3;

    return {
      id: randomUUID(),
      slug,
      displayName: Math.random() > 0.2 ? firstName : null,
      name,
      email,
      emailVerified: true,
      avatarUrl,
      bannerUrl: hasBanner ? pick(BANNER_URLS) : null,
      bio: pick(BIOS),
      socials: socials as any,
      image: avatarUrl,
      enrolledUnits: enrolledUnits as any,
      onboardingCompleted: true,
      createdAt,
      updatedAt: new Date(),
    };
  });

  await db.user.createMany({ data: users });
  console.log(`  Created ${users.length} users`);

  console.log("Seeding events...");

  interface EventSeed {
    id: string;
    title: string;
    date: Date;
    location: string;
    bannerUrl: string;
    content: string | null;
    organiserIds: string[];
    participantIds: string[];
  }

  const eventSeeds: EventSeed[] = EVENT_TITLES.map((title, i) => {
    const isPast = Math.random() > 0.5;
    const date = isPast
      ? randomDate(
          new Date(now.getFullYear(), now.getMonth() - 3, 1),
          new Date(now.getTime() - 24 * 60 * 60 * 1000),
        )
      : randomDate(
          new Date(now.getTime() + 24 * 60 * 60 * 1000),
          new Date(now.getFullYear(), now.getMonth() + 3, 1),
        );

    const numOrganisers = randomInt(1, 3);
    const organisers = pickN(users, numOrganisers);
    const remainingUsers = users.filter(
      (u) => !organisers.some((o) => o.id === u.id),
    );
    const numParticipants = randomInt(3, Math.min(15, remainingUsers.length));
    const participants = pickN(remainingUsers, numParticipants);

    const participantIds: string[] = participants.map((u) => u.id);
    if (realUsers.length > 0 && Math.random() > 0.3) {
      for (const ru of realUsers) {
        if (!participantIds.includes(ru.id) && !organisers.some((o) => o.id === ru.id)) {
          participantIds.push(ru.id);
        }
      }
    }

    return {
      id: randomUUID(),
      title,
      date,
      location: pick(EVENT_LOCATIONS),
      bannerUrl: EVENT_BANNER_URLS[i % EVENT_BANNER_URLS.length]!,
      content: EVENT_DESCRIPTIONS[i] ?? null,
      organiserIds: organisers.map((u) => u.id),
      participantIds,
    };
  });

  await db.event.createMany({
    data: eventSeeds.map(
      ({ organiserIds: _, participantIds: __, ...rest }) => rest,
    ),
  });

  const eventRelationOps = eventSeeds.flatMap((e) => [
    ...e.organiserIds.map((uid) =>
      db.event.update({
        where: { id: e.id },
        data: { organisers: { connect: { id: uid } } },
      }),
    ),
    ...e.participantIds.map((uid) =>
      db.event.update({
        where: { id: e.id },
        data: { participants: { connect: { id: uid } } },
      }),
    ),
  ]);

  const BATCH_SIZE = 20;
  for (let i = 0; i < eventRelationOps.length; i += BATCH_SIZE) {
    await db.$transaction(eventRelationOps.slice(i, i + BATCH_SIZE));
  }
  console.log(
    `  Created ${eventSeeds.length} events with organisers & participants`,
  );

  console.log("Seeding connections...");

  const connectionPairs = new Set<string>();
  const connectionOps: ReturnType<typeof db.user.update>[] = [];
  const connectionRequestData: {
    senderId: string;
    receiverId: string;
    status: "ACCEPTED";
    createdAt: Date;
  }[] = [];

  for (const user of users) {
    const numConnections = randomInt(2, 6);
    const potentialConnections = users.filter((u) => u.id !== user.id);
    const targets = pickN(potentialConnections, numConnections);

    for (const target of targets) {
      const pairKey = [user.id, target.id].sort().join(":");
      if (connectionPairs.has(pairKey)) continue;
      connectionPairs.add(pairKey);

      connectionOps.push(
        db.user.update({
          where: { id: user.id },
          data: { connections: { connect: { id: target.id } } },
        }),
      );

      connectionRequestData.push({
        senderId: user.id,
        receiverId: target.id,
        status: "ACCEPTED",
        createdAt: randomDate(
          new Date(now.getFullYear(), now.getMonth() - 4, 1),
          now,
        ),
      });
    }
  }

  if (realUsers.length > 0) {
    const connectToReal = pickN(users, Math.min(10, users.length));
    for (const ru of realUsers) {
      for (const seedUser of connectToReal) {
        const pairKey = [ru.id, seedUser.id].sort().join(":");
        if (connectionPairs.has(pairKey)) continue;
        connectionPairs.add(pairKey);

        connectionOps.push(
          db.user.update({
            where: { id: ru.id },
            data: { connections: { connect: { id: seedUser.id } } },
          }),
        );

        connectionRequestData.push({
          senderId: seedUser.id,
          receiverId: ru.id,
          status: "ACCEPTED",
          createdAt: randomDate(
            new Date(now.getFullYear(), now.getMonth() - 4, 1),
            now,
          ),
        });
      }
    }
  }

  for (let i = 0; i < connectionOps.length; i += BATCH_SIZE) {
    await db.$transaction(connectionOps.slice(i, i + BATCH_SIZE));
  }
  await db.connectionRequest.createMany({ data: connectionRequestData });
  console.log(`  Created ${connectionPairs.size} accepted connections`);

  console.log("Seeding pending connection requests...");

  const pendingPairs = new Set<string>();
  const pendingData: {
    senderId: string;
    receiverId: string;
    status: "PENDING";
    message: string | null;
  }[] = [];

  for (let i = 0; i < 20; i++) {
    const sender = pick(users);
    const receiver = pick(users.filter((u) => u.id !== sender.id));
    const pairKey = [sender.id, receiver.id].sort().join(":");

    if (connectionPairs.has(pairKey) || pendingPairs.has(pairKey)) continue;
    pendingPairs.add(pairKey);

    pendingData.push({
      senderId: sender.id,
      receiverId: receiver.id,
      status: "PENDING",
      message: Math.random() > 0.4 ? pick(MESSAGE_TEMPLATES) : null,
    });
  }

  if (realUsers.length > 0) {
    const pendingSenders = pickN(
      users.filter((u) => !connectionPairs.has([realUsers[0]!.id, u.id].sort().join(":"))),
      5,
    );
    for (const ru of realUsers) {
      for (const sender of pendingSenders) {
        const pairKey = [sender.id, ru.id].sort().join(":");
        if (connectionPairs.has(pairKey) || pendingPairs.has(pairKey)) continue;
        pendingPairs.add(pairKey);
        pendingData.push({
          senderId: sender.id,
          receiverId: ru.id,
          status: "PENDING",
          message: Math.random() > 0.4 ? pick(MESSAGE_TEMPLATES) : null,
        });
      }
    }
  }

  await db.connectionRequest.createMany({ data: pendingData });
  console.log(`  Created ${pendingData.length} pending connection requests`);

  console.log("Seeding messages...");

  const connectedPairsList = Array.from(connectionPairs).map((pair) => {
    const [a, b] = pair.split(":");
    return [a!, b!] as const;
  });

  const dmMessages: {
    content: string;
    senderId: string;
    receiverId: string;
    createdAt: Date;
  }[] = [];

  for (const [userA, userB] of pickN(
    connectedPairsList,
    Math.min(30, connectedPairsList.length),
  )) {
    const numMessages = randomInt(1, 5);
    for (let j = 0; j < numMessages; j++) {
      const isSenderA = Math.random() > 0.5;
      dmMessages.push({
        content: pick(MESSAGE_TEMPLATES),
        senderId: isSenderA ? userA : userB,
        receiverId: isSenderA ? userB : userA,
        createdAt: randomDate(
          new Date(now.getFullYear(), now.getMonth() - 2, 1),
          now,
        ),
      });
    }
  }

  const eventMessages: {
    content: string;
    senderId: string;
    eventId: string;
    createdAt: Date;
  }[] = [];

  for (const event of pickN(eventSeeds, 10)) {
    const numMessages = randomInt(2, 6);
    for (let j = 0; j < numMessages; j++) {
      const sender = pick(users);
      eventMessages.push({
        content: pick(MESSAGE_TEMPLATES),
        senderId: sender.id,
        eventId: event.id,
        createdAt: randomDate(
          new Date(now.getFullYear(), now.getMonth() - 1, 1),
          now,
        ),
      });
    }
  }

  await db.message.createMany({ data: [...dmMessages, ...eventMessages] });
  console.log(`  Created ${dmMessages.length + eventMessages.length} messages`);

  if (es) {
    console.log("Indexing all data in Elasticsearch...");

    const allEvents = await db.event.findMany({
      include: {
        organisers: { select: { id: true, name: true } },
        participants: { select: { id: true } },
      },
    });
    for (const event of allEvents) {
      await indexEvent(es, event);
    }
    console.log(`  Indexed ${allEvents.length} events`);

    const allUsers = await db.user.findMany({
      include: {
        connections: { select: { id: true } },
        connectedBy: { select: { id: true } },
        upcomingEvents: { select: { id: true } },
        organisedEvents: { select: { id: true } },
      },
    });
    for (const user of allUsers) {
      await indexUser(es, user);
    }
    console.log(`  Indexed ${allUsers.length} users`);
  } else {
    console.warn("Elasticsearch not available – skipping indexing");
  }

  console.log("\nSeed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
