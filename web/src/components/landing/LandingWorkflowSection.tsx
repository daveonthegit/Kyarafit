"use client";

import { motion } from "framer-motion";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const MAX_WIDTH = "max-w-7xl mx-auto w-full";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const FEATURE_ITEMS = [
  {
    step: "01",
    title: "Elements & closet",
    desc: "Catalog wigs, props, contacts, and materials. Reuse them across builds and keep photos, notes, and links in one place.",
    icon: "checkroom",
  },
  {
    step: "02",
    title: "Builds",
    desc: "Create cosplay projects with visuals, linked closet items, workflow trees, and task checklists for construction progress.",
    icon: "architecture",
  },
  {
    step: "03",
    title: "Conventions",
    desc: "Add events, assign which build you wear each day, and open packing views tied to that weekend.",
    icon: "festival",
  },
  {
    step: "04",
    title: "Packing & logistics",
    desc: "Checklists per convention so cases, tools, and last-minute fixes don’t get left behind.",
    icon: "luggage",
  },
  {
    step: "05",
    title: "Planner & tasks",
    desc: "See tasks across builds on the planner. On each build, track deadlines, assignees, and checklist state.",
    icon: "task_alt",
  },
  {
    step: "06",
    title: "Feed & discover",
    desc: "Follow activity from people you care about and browse public builds for inspiration.",
    icon: "travel_explore",
  },
] as const;

export function LandingWorkflowSection() {
  return (
    <section
      className={`border-t border-kyar-borderSubtle bg-kyar-bgWarm py-24 sm:py-32 ${SECTION_PADDING}`}
      aria-labelledby="how-heading"
    >
      <div className={MAX_WIDTH}>
        <div className="mb-16 max-w-3xl">
          <h2
            id="how-heading"
            className="font-sans-wide mb-4 text-xs font-semibold uppercase tracking-widest text-kyar-accent"
          >
            What you can do
          </h2>
          <p className="font-serif-elegant text-3xl sm:text-4xl">The web app, end to end.</p>
          <p className="mt-4 text-base leading-relaxed text-kyar-textSecondary">
            Elements and closet, builds and tasks, conventions and packing—plus planner, feed, and
            discover when you want to look beyond your own archive.
          </p>
        </div>
        <motion.div
          className="grid gap-y-12 gap-x-8 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ margin: "-50px", amount: 0.25 }}
        >
          {FEATURE_ITEMS.map((item) => (
            <motion.div variants={fadeUp} key={item.step} className="group relative">
              <div className="mb-6 font-serif-elegant text-5xl text-kyar-border transition-colors duration-500 group-hover:text-kyar-accent">
                {item.step}
              </div>
              <span
                className="material-symbols-outlined mb-5 block text-3xl text-kyar-textSecondary transition-colors group-hover:text-kyar-text"
                aria-hidden
              >
                {item.icon}
              </span>
              <h3 className="font-sans-wide mb-3 text-sm font-bold uppercase tracking-widest">
                {item.title}
              </h3>
              <p className="text-base leading-relaxed text-kyar-textSecondary">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
