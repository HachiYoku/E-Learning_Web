import { useNavigate } from "react-router-dom";

const lineIcon = "/logo/Line.svg";
const facebookIcon = "/logo/facebook.svg";
const instagramIcon = "/logo/instagram.svg";
const landing0 = "/hero/hero2.jpg";
const landing = "/hero/hero1.jpg";

function Hero() {
  const navigate = useNavigate();

  return (
    <section className="relative px-4 sm:px-6 md:px-10 lg:px-20 py-12 md:py-20 bg-white overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
        {/* Background Shape */}
        <div
          className="absolute hidden md:block -left-40 lg:-left-72 -bottom-40 w-96 lg:w-[660px] h-96 lg:h-[640px] rounded-full opacity-70"
          style={{ backgroundColor: "#FCDCE2" }}
        />

        {/* LEFT */}
        <div className="relative z-10 max-w-xl">
          <h1 className="text-3xl sm:text-4xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-[1.2]">
            Speak English with 
            Confidence, Master Grammar at{" "}
            <span className="text-[#F8A2C0]">Mind Ploy English</span>
          </h1>

          <p className="text-[#8B6F61] mt-5 text-base md:text-xl leading-relaxed">
            เรียนอังกฤษแบบสบายๆ ใช้ได้จริง สนุกได้ทุกการเรียนรู้
          </p>

          {/* CTA */}
          <button
            onClick={() => navigate("/courses")}
            className="mt-8 bg-black text-white px-8 py-3 rounded-xl font-medium 
            hover:bg-gray-800 transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2"
          >
            ดูคอร์สเรียน →
          </button>

          {/* Divider */}
          <div className="w-74 h-[2px] bg-black mt-10"></div>

          {/* OFFER */}
          <div className="mt-6">
            <h3 className="font-semibold text-gray-800 mb-2 text-base">
              คอร์สและบริการของเรา:
            </h3>
            <ul className="space-y-2 text-gray-700 text-sm">
              <li>• ติวสอนตัวต่อตัว ทั้งแบบ online และ onsite</li>
              <li>• ฝึกทำโจทย์เตรียมสอบ TCAS TOEIC IELTS</li>
              <li>• คอร์สสนทนา ฟังพูด</li>
            </ul>
          </div>

          {/* SOCIAL */}
          <div className="mt-6">
            <p className="font-semibold text-gray-800 mb-2 text-base">
              Contact us via:
            </p>
            <div className="flex gap-4">
              <img
                src={lineIcon}
                className="w-7 h-7 hover:scale-110 transition"
              />
              <img
                src={facebookIcon}
                className="w-7 h-7 hover:scale-110 transition"
              />
              <img
                src={instagramIcon}
                className="w-7 h-7 hover:scale-110 transition"
              />
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="relative">
          {/* MOBILE */}
          <div className="md:hidden flex flex-col gap-4">
            <div className="rounded-xl text-center shadow-md p-4 bg-[#FCDCE2]">
              <h4 className="font-bold text-sm">Grammar Foundations</h4>
            </div>

            <div className="flex gap-3 h-56">
              <img src={landing0} className="rounded-xl w-1/2 object-cover" />
              <img src={landing} className="rounded-xl w-1/2 object-cover" />
            </div>

            <div className="rounded-xl shadow-md text-center p-4 bg-[#DDF1FC]">
              <h4 className="font-bold text-sm">English Communication</h4>
            </div>
          </div>

          {/* DESKTOP */}
          <div className="hidden md:block relative h-[450px] lg:h-[520px]">
            {/* Back Image */}
            <div className="absolute top-0 right-0 w-[60%] h-[70%] rounded-2xl overflow-hidden shadow-md">
              <img src={landing} className="w-full h-full object-cover" />
            </div>

            {/* Front Image */}
            <div className="absolute bottom-0 left-0 w-[55%] h-[70%] rounded-3xl overflow-hidden shadow-xl">
              <img src={landing0} className="w-full h-full object-cover" />
            </div>

            {/* Card 1 */}
            <div className="absolute top-6 left-0 bg-[#FCDCE2] backdrop-blur-md shadow-lg p-4 text-center rounded-xl w-56">
              <h4 className="font-bold text-sm">Grammar Foundations</h4>
            </div>

            {/* Card 2 */}
            <div className="absolute bottom-6 right-0 bg-[#DDF1FC] backdrop-blur-md shadow-lg p-4 text-center rounded-xl w-56">
              <h4 className="font-bold text-sm">English Communication</h4>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
