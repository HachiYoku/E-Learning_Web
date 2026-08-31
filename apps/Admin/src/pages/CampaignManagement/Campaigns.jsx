import { CheckCircle2, Clock3, ImagePlus, Pencil, Search, Send, Trash2, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ConfirmationModal from "../../components/ConfirmationModal";
import { fetchContactLeads } from "../../services/contactLeadService";
import { fetchUsers } from "../../services/userService";
import { createCampaign, deleteDraftCampaign, fetchCampaigns, sendCampaign, updateDraftCampaign } from "../../services/campaignService";

function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [leads, setLeads] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [editingCampaignId, setEditingCampaignId] = useState("");
  const [draftToDelete, setDraftToDelete] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [sendingId, setSendingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [expandedCampaignId, setExpandedCampaignId] = useState("");
  const [recipientTab, setRecipientTab] = useState("system");
  const [recipientSearch, setRecipientSearch] = useState("");

  const systemRecipients = useMemo(() => systemUsers.map((user) => ({ id: `system:${user.id}`, name: user.name, email: user.email, type: "System user" })), [systemUsers]);
  const subscribers = useMemo(() => leads.filter((lead) => lead.marketingOptIn).map((lead) => ({ id: `contact:${lead._id}`, name: lead.name, email: lead.email, type: "Subscriber" })), [leads]);
  const recipientOptions = useMemo(() => [...systemRecipients, ...subscribers], [systemRecipients, subscribers]);
  const selectedRecipients = useMemo(() => recipientOptions.filter((recipient) => selectedIds.includes(recipient.id)), [recipientOptions, selectedIds]);
  const visibleRecipients = useMemo(() => {
    const recipients = recipientTab === "system" ? systemRecipients : subscribers;
    const query = recipientSearch.trim().toLowerCase();
    if (!query) return recipients;
    return recipients.filter((recipient) => `${recipient.name} ${recipient.email}`.toLowerCase().includes(query));
  }, [recipientSearch, recipientTab, subscribers, systemRecipients]);
  const allVisibleSelected = visibleRecipients.length > 0 && visibleRecipients.every((recipient) => selectedIds.includes(recipient.id));
  const selectedSystemCount = selectedRecipients.filter((recipient) => recipient.id.startsWith("system:")).length;
  const selectedSubscriberCount = selectedRecipients.length - selectedSystemCount;
  const deletingDraft = campaigns.find((campaign) => campaign._id === draftToDelete);

  const loadCampaigns = async () => {
    try { setCampaigns(await fetchCampaigns()); } catch (error) { setStatus({ type: "error", message: error.message }); }
  };

  useEffect(() => {
    loadCampaigns();
    fetchContactLeads().then(setLeads).catch((error) => setStatus({ type: "error", message: error.message }));
    fetchUsers().then(setSystemUsers).catch((error) => setStatus({ type: "error", message: error.message }));
  }, []);

  const clearImage = () => { setImageFile(null); setImagePreview(""); };
  const resetComposer = () => { setSubject(""); setMessage(""); setSelectedIds([]); clearImage(); setEditingCampaignId(""); setRecipientSearch(""); setRecipientTab("system"); };
  const toggleRecipient = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectVisibleRecipients = () => setSelectedIds((current) => allVisibleSelected
    ? current.filter((id) => !visibleRecipients.some((recipient) => recipient.id === id))
    : [...new Set([...current, ...visibleRecipients.map((recipient) => recipient.id)])]);
  const updateImage = (event) => {
    const file = event.target.files?.[0] || null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : "");
  };

  const startEditingDraft = (campaign) => {
    setSubject(campaign.subject);
    setMessage(campaign.message);
    setSelectedIds((campaign.selectedRecipients || []).map((recipient) => `${recipient.recordType}:${recipient.recipientId}`));
    setImageFile(null);
    setImagePreview(campaign.image || "");
    setEditingCampaignId(campaign._id);
    setRecipientSearch("");
    setRecipientTab("system");
    setStatus({ type: "", message: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveCampaign = async (sendNow) => {
    if (!subject.trim() || !message.trim() || !selectedIds.length) {
      setStatus({ type: "error", message: "Add a subject, message, and at least one recipient." });
      return;
    }
    setIsSaving(true); setStatus({ type: "", message: "" });
    try {
      const payload = { subject, message, recipientIds: selectedIds, imageFile };
      const campaign = editingCampaignId ? await updateDraftCampaign(editingCampaignId, payload) : await createCampaign(payload);
      if (sendNow) {
        setSendingId(campaign._id);
        const sentCampaign = await sendCampaign(campaign._id);
        setStatus({ type: "success", message: `Campaign ${sentCampaign.status === "sent" ? "sent" : "completed with delivery issues"}.` });
      } else {
        setStatus({ type: "success", message: editingCampaignId ? "Draft updated successfully." : "Draft saved successfully." });
      }
      resetComposer();
      await loadCampaigns();
    } catch (error) { setStatus({ type: "error", message: error.message || "Unable to save the campaign." }); }
    finally { setIsSaving(false); setSendingId(""); }
  };

  const handleSendDraft = async (id) => {
    setSendingId(id); setStatus({ type: "", message: "" });
    try { const campaign = await sendCampaign(id); setStatus({ type: "success", message: `Campaign sent to ${campaign.sentCount} recipients.` }); await loadCampaigns(); }
    catch (error) { setStatus({ type: "error", message: error.message || "Unable to send the campaign." }); }
    finally { setSendingId(""); }
  };

  const confirmDeleteDraft = async () => {
    if (!draftToDelete) return;
    setDeletingId(draftToDelete);
    try { const response = await deleteDraftCampaign(draftToDelete); setStatus({ type: "success", message: response.message }); await loadCampaigns(); }
    catch (error) { setStatus({ type: "error", message: error.message || "Unable to delete the draft." }); }
    finally { setDeletingId(""); setDraftToDelete(""); }
  };

  const RecipientList = ({ recipients }) => recipients.length ? (
    <>
      {recipients.map((recipient) => (
        <label key={recipient.id} className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-gray-50">
          <input type="checkbox" checked={selectedIds.includes(recipient.id)} onChange={() => toggleRecipient(recipient.id)} className="h-4 w-4 rounded text-pink-600 focus:ring-pink-500" />
          <span className="min-w-0"><span className="block text-sm font-medium text-gray-800">{recipient.name}</span><span className="block truncate text-xs text-gray-500">{recipient.email}</span></span>
        </label>
      ))}
    </>
  ) : null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C97112]">Email marketing</p><h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl md:text-4xl">Updates & Campaigns</h1><p className="mt-2 text-sm text-gray-600">Choose recipients, attach an image, edit saved drafts, and retain your campaign history.</p></div>
      <div className="grid gap-6 xl:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={(event) => { event.preventDefault(); saveCampaign(false); }} className="rounded-xl bg-white p-5 shadow sm:p-6">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-gray-900">{editingCampaignId ? "Edit draft" : "Compose an update"}</h2>{editingCampaignId ? <button type="button" onClick={resetComposer} className="text-sm font-semibold text-pink-600 hover:text-pink-700">Cancel editing</button> : null}</div>
          <label className="mt-5 block text-sm font-semibold text-gray-800">Subject<input required value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100" /></label>
          <label className="mt-4 block text-sm font-semibold text-gray-800">Message<textarea required rows="6" value={message} onChange={(event) => setMessage(event.target.value)} className="mt-1.5 w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100" /></label>
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-gray-800">Recipients</p><p className="mt-0.5 text-xs text-gray-500">{selectedRecipients.length} selected · {selectedSystemCount} system users · {selectedSubscriberCount} subscribers</p></div><button type="button" onClick={() => setSelectedIds([])} disabled={!selectedRecipients.length} className="text-xs font-semibold text-pink-600 disabled:text-gray-400">Clear selection</button></div>
            {selectedRecipients.length ? <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-pink-100 bg-pink-50 p-2">{selectedRecipients.slice(0, 3).map((recipient) => <button type="button" key={recipient.id} onClick={() => toggleRecipient(recipient.id)} className="inline-flex max-w-full items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm"><span className="truncate">{recipient.name}</span><X className="shrink-0" size={12} /></button>)}{selectedRecipients.length > 3 ? <span className="px-2 py-1 text-xs font-semibold text-pink-700">+{selectedRecipients.length - 3} more selected</span> : null}</div> : <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Search and choose the people who should receive this update.</p>}
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
              <div className="flex border-b border-gray-200 bg-gray-50 p-1"><button type="button" onClick={() => setRecipientTab("system")} className={`flex-1 rounded-md px-3 py-2 text-xs font-bold ${recipientTab === "system" ? "bg-white text-pink-600 shadow-sm" : "text-gray-500"}`}>System users ({systemRecipients.length})</button><button type="button" onClick={() => setRecipientTab("subscribers")} className={`flex-1 rounded-md px-3 py-2 text-xs font-bold ${recipientTab === "subscribers" ? "bg-white text-pink-600 shadow-sm" : "text-gray-500"}`}>Subscribers ({subscribers.length})</button></div>
              <div className="m-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-100"><Search size={17} className="shrink-0 text-gray-400" aria-hidden="true" /><input value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} placeholder={`Search ${recipientTab === "system" ? "system users" : "subscribers"}`} aria-label={`Search ${recipientTab === "system" ? "system users" : "subscribers"} by name or email`} className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400" />{recipientSearch ? <button type="button" onClick={() => setRecipientSearch("")} className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Clear recipient search"><X size={15} /></button> : null}</div>
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2"><span className="text-xs text-gray-500">{visibleRecipients.length} matching</span><button type="button" onClick={selectVisibleRecipients} disabled={!visibleRecipients.length} className="text-xs font-bold text-pink-600 disabled:text-gray-400">{allVisibleSelected ? "Clear filtered" : "Select filtered"}</button></div>
              <div className="max-h-52 overflow-y-auto p-2"><RecipientList recipients={visibleRecipients} />{!visibleRecipients.length ? <p className="p-4 text-center text-sm text-gray-500">No matching {recipientTab === "system" ? "system users" : "subscribers"}.</p> : null}</div>
            </div>
          </div>
          <div className="mt-5"><p className="text-sm font-semibold text-gray-800">Campaign image <span className="font-normal text-gray-500">(optional, max 5 MB)</span></p><label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600"><ImagePlus size={18} />Upload image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={updateImage} className="hidden" /></label>{imagePreview ? <div className="relative mt-3 max-w-full overflow-hidden rounded-lg border border-gray-200" style={{ width: 300 }}><img src={imagePreview} alt="Campaign preview" className="h-36 w-full object-cover" /><button type="button" onClick={clearImage} className="absolute right-2 top-2 rounded-full bg-white p-1 text-gray-600 shadow"><X size={16} /></button></div> : null}</div>
          {status.message ? <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{status.message}</p> : null}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row"><button disabled={isSaving} className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-60">{editingCampaignId ? "Save changes" : "Save draft"}</button><button type="button" disabled={isSaving} onClick={() => saveCampaign(true)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-pink-600 disabled:opacity-60"><Send size={16} />Send now</button></div>
        </form>
        <section className="rounded-xl bg-white p-5 shadow sm:p-6">
          <div className="flex items-center justify-between border-b border-gray-200 pb-5">
            <div><h2 className="text-lg font-bold text-gray-900">Campaign history</h2><p className="mt-1 text-sm text-gray-600">Drafts and sent-message records.</p></div>
            <Clock3 size={20} className="text-gray-400" />
          </div>
          <div className="mt-5 space-y-3">
            {campaigns.map((campaign) => {
              const expanded = expandedCampaignId === campaign._id;
              const recipientCount = campaign.recipientCount || campaign.selectedRecipients?.length || 0;
              return (
                <article key={campaign._id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-bold text-gray-900">{campaign.subject}</h3><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${campaign.status === "sent" ? "bg-green-100 text-green-700" : campaign.status === "draft" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{campaign.status}</span></div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500"><span className="inline-flex items-center gap-1"><UsersRound size={14} />{recipientCount} recipients</span><span className="inline-flex items-center gap-1"><CheckCircle2 size={14} />{campaign.sentCount || 0} sent</span><span>{campaign.sentAt ? `Sent ${new Date(campaign.sentAt).toLocaleString()}` : `Saved ${new Date(campaign.createdAt).toLocaleString()}`}</span></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setExpandedCampaignId(expanded ? "" : campaign._id)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">{expanded ? "Hide details" : "View details"}</button>
                      {campaign.status === "draft" ? <><button onClick={() => startEditingDraft(campaign)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"><Pencil size={15} />Edit</button><button onClick={() => handleSendDraft(campaign._id)} disabled={sendingId === campaign._id} className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><Send size={15} />{sendingId === campaign._id ? "Sending..." : "Send"}</button><button onClick={() => setDraftToDelete(campaign._id)} className="rounded-lg border border-red-200 p-2 text-red-600"><Trash2 size={16} /></button></> : null}
                    </div>
                  </div>
                  {expanded ? <div className="border-t border-gray-100 bg-gray-50 p-4"><div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">{campaign.image ? <img src={campaign.image} alt="Campaign" className="h-28 max-w-full rounded-lg object-cover" style={{ width: 300 }} /> : null}<p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{campaign.message}</p></div>{campaign.selectedRecipients?.length ? <details className="mt-4 rounded-lg bg-white px-3 py-2 text-xs text-gray-600"><summary className="cursor-pointer font-semibold text-gray-700">View selected recipients ({campaign.selectedRecipients.length})</summary><div className="mt-2 space-y-1">{campaign.selectedRecipients.map((recipient) => <p key={`${recipient.recordType}-${recipient.recipientId}`}><span className="font-medium">{recipient.name || "Recipient"}</span> · {recipient.email || "email unavailable"} <span className="text-gray-400">({recipient.recordType === "system" ? "System user" : "Subscriber"})</span></p>)}</div></details> : null}</div> : null}
                </article>
              );
            })}
            {!campaigns.length ? <p className="p-8 text-center text-sm text-gray-500">No campaigns yet. Create your first update.</p> : null}
          </div>
        </section>
      </div>
      <ConfirmationModal isOpen={Boolean(draftToDelete)} title="Delete draft" message={`Delete “${deletingDraft?.subject || "this draft"}”? This cannot be undone.`} confirmText={deletingId ? "Deleting..." : "Delete draft"} onConfirm={confirmDeleteDraft} onCancel={() => setDraftToDelete("")} isDangerous />
    </div>
  );
}

export default Campaigns;
