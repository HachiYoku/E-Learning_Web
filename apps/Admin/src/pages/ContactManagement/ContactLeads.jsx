import { Check, Copy, Mail, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchContactLeads } from "../../services/contactLeadService";

function ContactLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState("");
  const [copiedEmail, setCopiedEmail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchContactLeads().then(setLeads).catch((loadError) => setError(loadError.message));
  }, []);

  const filteredLeads = useMemo(() => leads.filter((lead) =>
    lead.name.toLowerCase().includes(search.toLowerCase()) || lead.email.toLowerCase().includes(search.toLowerCase())
  ), [leads, search]);
  const subscribedCount = leads.filter((lead) => lead.marketingOptIn).length;

  const copyEmail = async (email) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      window.setTimeout(() => setCopiedEmail(""), 1600);
    } catch {
      setError("Unable to copy the email address.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C97112]">Marketing contacts</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl md:text-4xl">Subscribers & Enquiries</h1>
          <p className="mt-2 text-sm text-gray-600">People who submitted the Get in touch form. Only opted-in contacts receive updates.</p>
        </div>
        <button onClick={() => navigate("/campaigns")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-600">
          <Send size={16} /> Send update ({subscribedCount})
        </button>
      </div>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subscribers and enquiries" className="mb-5 w-full max-w-md rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100" />
      {error ? <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full min-w-[740px]">
          <thead><tr className="border-b border-pink-200 bg-pink-100 text-left text-sm text-gray-900"><th className="px-5 py-4">Name</th><th className="px-5 py-4">Email</th><th className="px-5 py-4">Subscription</th><th className="px-5 py-4">Message</th><th className="px-5 py-4">Submitted</th></tr></thead>
          <tbody>{filteredLeads.map((lead) => <tr key={lead._id} className="border-b border-gray-100 align-top text-sm text-gray-700"><td className="px-5 py-4 font-semibold text-gray-900">{lead.name}</td><td className="px-5 py-4"><div className="flex items-center gap-2"><Mail size={15} className="text-gray-400" /><span>{lead.email}</span><button onClick={() => copyEmail(lead.email)} className="rounded p-1 text-gray-500 hover:bg-gray-100" title="Copy email">{copiedEmail === lead.email ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}</button></div></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${lead.marketingOptIn ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{lead.marketingOptIn ? "Subscribed" : "Enquiry only"}</span></td><td className="max-w-xs px-5 py-4 leading-relaxed text-gray-600">{lead.message || "—"}</td><td className="px-5 py-4 text-gray-500">{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : ""}</td></tr>)}</tbody>
        </table>
        {!filteredLeads.length ? <p className="px-6 py-10 text-center text-sm text-gray-500">No subscribers or enquiries found.</p> : null}
      </div>
    </div>
  );
}

export default ContactLeads;
