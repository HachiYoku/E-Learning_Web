import { createElement } from "react";
import { BookOpenCheck, ChevronRight, Layers3 } from "lucide-react";
import { Link } from "react-router-dom";

const choices = [
  { title: "Practice Flashcards", description: "Build vocabulary with the public flashcard sets created by Arun Thai.", to: "/app/practice/flashcards/public", icon: BookOpenCheck, color: "bg-[#FFF1D0] text-[#C97112]" },
  { title: "My Flashcards", description: "Create private decks for the words and phrases you want to remember.", to: "/app/practice/flashcards/mine", icon: Layers3, color: "bg-[#E9F4EA] text-[#246B35]" },
];

function StudentFlashcardsHub() {
  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
    <p className="text-xs font-bold uppercase tracking-[.22em] text-[#C97112]">Practice</p>
    <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Flashcards</h1>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#765F55] sm:text-base">Choose a ready-made vocabulary set or organize your own private study decks.</p>
    <div className="mt-8 grid gap-4 md:grid-cols-2 md:gap-5">
      {choices.map(({ title, description, to, icon, color }) => <Link key={to} to={to} className="group rounded-3xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_14px_34px_-28px_rgba(45,46,48,.5)] transition hover:-translate-y-0.5 hover:border-[#E58C1A]/35 hover:shadow-lg sm:p-6">
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>{createElement(icon, { className: "h-6 w-6" })}</span>
        <h2 className="mt-6 text-xl font-bold text-[#2D2E30]">{title}</h2>
        <p className="mt-2 min-h-12 text-sm leading-relaxed text-[#765F55]">{description}</p>
        <span className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-[#C97112]">Open <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
      </Link>)}
    </div>
  </div>;
}

export default StudentFlashcardsHub;
