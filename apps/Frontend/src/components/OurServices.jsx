import ServiceCard from "./ServiceCard";
import ContactChoiceModal from "./ContactChoiceModal";
import { useCallback, useRef, useState } from "react";

const asianMotherImage = "/service/asian-mother-enjoy-teach-explain-homework-child-daughter-online-study-homeschooling-home-home-quarantine-online-learning-new-normal-lifestyle.jpg";
const languageLearningImage = "/service/close-up-people-learning-language.jpg";
const teacherImage = "/service/medium-shot-smiley-teacher-with-whiteboard.jpg";

const services = [
  {
    number: "01",
    label: "Live class",
    image: asianMotherImage,
    title: "Live Zoom Classes",
    tagline: "Real-Time Practice & Guidance",
    description: "တိုက်ရိုက် စကားပြောလေ့ကျင့်နိုင်မည့် အဖွဲ့လိုက် သင်တန်းများနှင့် မိမိအဆင်ပြေရာ အချိန်ဇယားအတိုင်း သီးသန့်သင်ယူနိုင်မည့် One-on-One တန်းများ Zoom မှ တစ်ဆင့် သင်ကြားရေးအတွေ့အကြုံရှိ ဆရာ/ဆရာမများနှင့်အတူ လေ့ကျင့်သင်ယူနိုင်ပါသည်။",
    imageLoading: "eager",
  },
  {
    number: "02",
    label: "Self-paced",
    image: languageLearningImage,
    title: "Self-Paced Video Classes",
    tagline: "Learn Anytime, Anywhere",
    description: "ဖုန်း (သို့) ကွန်ပြူတာ ရှိရုံဖြင့် မိမိ၏ အလုပ်ချိန်၊ ကျောင်းချိန်များကြားမှ ကိုယ်ပိုင် Web App ပေါ်ရှိ Video သင်ခန်းစာများနဲ့ Quiz များကို အားလပ်ချိန်တိုင်း  အချိန်မရွေး၊ နေရာမရွေး  လေ့လာသင်ယူနိုင်ပါသည်။",
  },
  {
    number: "03",
    label: "Career Thai",
    image: teacherImage,
    title: "Job-Ready Thai Class",
    tagline: "Fast-Track Your Career",
    description: "လုပ်ငန်းခွင်မှာ ယုံကြည်မှုရှိရှိ အလုပ်လုပ်နိုင်ဖို့နဲ့ ပိုမိုကောင်းမွန်တဲ့ အလုပ်အကိုင်အခွင့်အလမ်းတွေ ရရှိနိုင်ဖို့ အသင့်တော် အကောင်းမွန်ဆုံး သင်ရိုးများဖြင့် သင်ကြားပေးသော ထိုင်းစာ/ထိုင်းစကားပြော သင်တန်းများကို တတ်ရောက်န်ိုင်ပါပြီ။",
  },
];

function OurServices() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const contactTriggerRef = useRef(null);

  const openContact = (event) => {
    contactTriggerRef.current = event.currentTarget;
    setIsContactOpen(true);
  };
  const closeContact = useCallback(() => setIsContactOpen(false), []);

  return (
    <section className="relative isolate overflow-hidden bg-[#FFF9EA] px-4 py-16 sm:px-6 md:px-10 md:pb-24 md:pt-16 lg:px-16">
      <div className="absolute -left-28 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/18 blur-3xl" aria-hidden="true" />
      <div className="absolute -right-24 top-0 -z-10 h-96 w-96 rounded-full bg-[#E9A9A0]/18 blur-3xl" aria-hidden="true" />
      <div className="mx-auto max-w-[1500px]">
        <div className="border-b border-[#2D2E30]/12 pb-8 sm:pb-10">
          <div className="max-w-2xl">
            <p className="text-brand-accent text-xs font-bold uppercase tracking-[0.24em]">Learn your way</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#2D2E30] sm:text-4xl md:text-5xl">
              Our Thai Learning <span className="text-[#E58C1A]">Services.</span>
            </h2>
            <p lang="my" className="font-myanmar mt-5 max-w-2xl text-sm leading-[1.85] text-[#765F55] sm:text-base">
              သင့်ရဲ့ ရည်မှန်းချက်၊ အချိန်နဲ့ သင်ယူမှုပုံစံနဲ့ အကိုက်ညီဆုံး ထိုင်းစာသင်တန်းကို ရွေးချယ်လိုက်ပါ။
            </p>
          </div>
        </div>

        <div className="grid items-stretch gap-6 pt-10 sm:gap-8 md:grid-cols-2 md:gap-8 md:pt-14 lg:grid-cols-3 lg:gap-10">
          {services.map((service) => (
            <ServiceCard
              key={service.title}
              number={service.number}
              label={service.label}
              image={service.image}
              title={service.title}
              tagline={service.tagline}
              description={service.description}
              imageLoading={service.imageLoading}
              onContact={openContact}
            />
          ))}
        </div>
      </div>
      <ContactChoiceModal isOpen={isContactOpen} onClose={closeContact} returnFocusRef={contactTriggerRef} />
    </section>
  );
}

export default OurServices;
