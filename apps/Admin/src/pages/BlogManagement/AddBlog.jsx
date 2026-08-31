import { ArrowLeft, Bold, Italic, Link2, Quote, Redo2, Type, Undo2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { createBlog } from "../../services/blogService";
import { validateFileSize } from "../../utils/fileValidation";

function AddBlog() {
  const navigate = useNavigate();
  const contentRef = useRef(null);
  const titleRef = useRef(null);
  const selectedRangeRef = useRef(null);
  const editorHistoryRef = useRef({ entries: [""], index: 0 });
  const initialFormRef = useRef(JSON.stringify({ title: "", content: "", image: "", hasImageFile: false }));
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    image: "",
    imageFile: null,
  });
  const [isEditorEmpty, setIsEditorEmpty] = useState(true);
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, heading: false, quote: false, link: false });
  const [toolbar, setToolbar] = useState({
    visible: false,
    top: 0,
    left: 0,
  });
  const [linkInput, setLinkInput] = useState({
    visible: false,
    url: "https://",
    top: 0,
    left: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

  const getFormSnapshot = ({ title, content, image, imageFile }) =>
    JSON.stringify({ title, content, image, hasImageFile: Boolean(imageFile) });

  const getActiveFormats = () => {
    const selection = window.getSelection();
    const selectedNode = selection?.anchorNode;
    const selectedElement = selectedNode?.nodeType === 1 ? selectedNode : selectedNode?.parentElement;

    return {
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      heading: selectedElement?.closest("h3") != null,
      quote: selectedElement?.closest("blockquote") != null,
      link: selectedElement?.closest("a") != null,
    };
  };

  useEffect(() => {
    const titleField = titleRef.current;
    if (!titleField) {
      return;
    }

    titleField.style.height = "auto";
    titleField.style.height = `${Math.min(titleField.scrollHeight, 160)}px`;
  }, [formData.title]);

  const hasUnsavedChanges = getFormSnapshot(formData) !== initialFormRef.current;

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const recordEditorHistory = (content) => {
    const history = editorHistoryRef.current;

    if (history.entries[history.index] === content) {
      return;
    }

    const entries = [...history.entries.slice(0, history.index + 1), content];
    editorHistoryRef.current = { entries, index: entries.length - 1 };
  };

  const handleEditorChange = ({ recordHistory = true } = {}) => {
    const content = contentRef.current?.innerHTML || "";
    const plainText = contentRef.current?.textContent || "";

    setFormData((prev) => ({
      ...prev,
      content,
    }));
    setIsEditorEmpty(plainText.trim() === "");

    if (recordHistory) {
      recordEditorHistory(content);
    }
  };

  const handleUndoRedo = (direction) => {
    const editor = contentRef.current;
    const history = editorHistoryRef.current;
    const nextIndex = direction === "undo" ? history.index - 1 : history.index + 1;

    if (!editor || nextIndex < 0 || nextIndex >= history.entries.length) {
      return;
    }

    editor.innerHTML = history.entries[nextIndex];
    editorHistoryRef.current = { ...history, index: nextIndex };
    editor.focus();
    handleEditorChange({ recordHistory: false });
    setActiveFormats(getActiveFormats());
  };

  const handleEditorKeyDown = (event) => {
    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();
      handleUndoRedo(event.shiftKey ? "redo" : "undo");
    } else if (key === "y") {
      event.preventDefault();
      handleUndoRedo("redo");
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const sizeError = validateFileSize(file, "Blog image");
    if (sizeError) {
      setError(sizeError);
      e.target.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setFormData((prev) => ({
      ...prev,
      image: previewUrl,
      imageFile: file,
    }));
    setError("");
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString() || "";

    setActiveFormats(getActiveFormats());

    if (!selectedText.length) {
      setToolbar((prev) => ({ ...prev, visible: false }));
      setLinkInput((prev) => ({ ...prev, visible: false }));
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    selectedRangeRef.current = selection.getRangeAt(0).cloneRange();
    setToolbar({
      visible: true,
      top: rect.top - 60,
      left: rect.left + 50,
    });
  };

  const applyFormat = (format) => {
    const editor = contentRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    const currentFormats = getActiveFormats();

    switch (format) {
      case "bold":
        document.execCommand("bold", false, null);
        break;
      case "italic":
        document.execCommand("italic", false, null);
        break;
      case "heading":
        document.execCommand("formatBlock", false, currentFormats.heading ? "p" : "h3");
        break;
      case "quote":
        document.execCommand("formatBlock", false, currentFormats.quote ? "p" : "blockquote");
        break;
      case "link": {
        if (currentFormats.link) {
          document.execCommand("unlink", false, null);
          break;
        }

        const selection = window.getSelection();
        if (!selection?.toString()) {
          setError("Please select text before adding a link.");
          return;
        }

        const rect = selection.getRangeAt(0).getBoundingClientRect();
        selectedRangeRef.current = selection.getRangeAt(0).cloneRange();
        setLinkInput({
          visible: true,
          url: "https://",
          top: rect.top - 8,
          left: rect.left + 50,
        });
        break;
      }
      default:
        break;
    }

    handleEditorChange();
    setActiveFormats(getActiveFormats());
    if (format !== "link") {
      setToolbar((prev) => ({ ...prev, visible: true }));
    }
  };

  const handleLinkApply = () => {
    const editor = contentRef.current;
    const url = linkInput.url.trim();

    if (!editor || !selectedRangeRef.current || !url) {
      setError("Please enter a valid URL.");
      return;
    }

    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(selectedRangeRef.current);
    document.execCommand("createLink", false, url);

    handleEditorChange();
    setActiveFormats(getActiveFormats());
    setLinkInput((prev) => ({ ...prev, visible: false }));
    setToolbar((prev) => ({ ...prev, visible: false }));
    setError("");
  };

  const handleLinkCancel = () => {
    setLinkInput((prev) => ({ ...prev, visible: false }));
  };

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setIsDiscardDialogOpen(true);
      return;
    }

    navigate("/blog");
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    const plainText = contentRef.current?.textContent || "";

    if (!formData.title.trim() || !plainText.trim() || !formData.imageFile) {
      setError("Please fill in the title, content, and image before publishing.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await createBlog({
        title: formData.title.trim(),
        content: formData.content,
        imageFile: formData.imageFile,
      });
      initialFormRef.current = getFormSnapshot(formData);
      navigate("/blog");
    } catch (submitError) {
      setError(submitError.message || "Failed to publish blog");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 px-4 py-4 sm:px-6 md:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center sm:gap-0">
          <button
            type="button"
            onClick={handleBackClick}
            className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 sm:text-base"
          >
            <ArrowLeft size={18} className="sm:h-5 sm:w-5" />
            <span>Back</span>
          </button>
          <h1 className="flex-1 text-center text-2xl font-bold text-gray-900 sm:text-3xl md:text-4xl">
            Add Blog
          </h1>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-pink-300 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:px-6 sm:text-base"
          >
            {isSubmitting ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 md:p-8">
        {error ? (
          <div className="mx-auto mb-6 max-w-6xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:gap-12 lg:grid-cols-2">
          <div>
            <label className="mb-3 block text-xs font-semibold text-gray-900 sm:text-sm md:mb-4">
              Upload blog image :
            </label>
            <div className="relative flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-colors hover:bg-gray-100 group sm:min-h-80 sm:p-8 md:min-h-96 md:p-12">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              {formData.image ? (
                <img src={formData.image} alt="Blog preview" className="h-full w-full rounded-lg object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500 sm:gap-3">
                  <svg className="h-6 w-6 sm:h-8 sm:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-xs font-medium sm:text-sm">Upload</span>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">Image must be 5 MB or smaller.</p>
          </div>

          <div className="space-y-4">
            <textarea
              ref={titleRef}
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Title"
              rows={1}
              aria-label="Blog title"
              className="w-full min-h-[2.5rem] max-h-40 resize-none overflow-y-auto border-none bg-transparent p-0 text-2xl font-bold leading-tight text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0 sm:min-h-[3rem] sm:text-3xl md:text-4xl"
            />

            <div
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onMouseUp={handleTextSelection}
              onKeyUp={handleTextSelection}
              onKeyDown={handleEditorKeyDown}
              onInput={handleEditorChange}
              onFocus={(e) => {
                if (e.currentTarget.textContent.trim() === "Start writing...") {
                  e.currentTarget.innerHTML = "";
                  setIsEditorEmpty(true);
                }
              }}
              onBlur={(e) => {
                if (e.currentTarget.textContent.trim() === "") {
                  e.currentTarget.innerHTML = "Start writing...";
                  setIsEditorEmpty(true);
                }
              }}
              className=" w-full resize-none overflow-y-auto whitespace-pre-wrap px-0 py-4 text-sm text-gray-700 outline-none focus:ring-0 sm:h-80 sm:text-base"
              style={{
                minHeight: "420px",
                color: isEditorEmpty ? "#d1d5db" : "#374151",
              }}
            >
              Start writing...
            </div>
          </div>
        </div>
      </div>

      {toolbar.visible ? (
        <div
          className="animate-fadeIn fixed z-50 flex items-center gap-2 rounded-lg bg-gray-900 p-2 text-white shadow-lg"
          style={{ top: `${toolbar.top}px`, left: `${toolbar.left}px` }}
        >
          <button
            onClick={() => applyFormat("bold")}
            onMouseDown={(event) => event.preventDefault()}
            className={`flex items-center justify-center rounded p-2 transition-colors ${activeFormats.bold ? "bg-gray-700 text-pink-300" : "hover:bg-gray-700"}`}
            title="Bold"
            aria-label="Bold"
            aria-pressed={activeFormats.bold}
          >
            <Bold size={18} />
          </button>
          <button
            onClick={() => applyFormat("italic")}
            onMouseDown={(event) => event.preventDefault()}
            className={`flex items-center justify-center rounded p-2 transition-colors ${activeFormats.italic ? "bg-gray-700 text-pink-300" : "hover:bg-gray-700"}`}
            title="Italic"
            aria-label="Italic"
            aria-pressed={activeFormats.italic}
          >
            <Italic size={18} />
          </button>
          <div className="h-6 w-px bg-gray-700" />
          <button
            onClick={() => applyFormat("heading")}
            onMouseDown={(event) => event.preventDefault()}
            className={`flex items-center justify-center rounded p-2 transition-colors ${activeFormats.heading ? "bg-gray-700 text-pink-300" : "hover:bg-gray-700"}`}
            title="Heading"
            aria-label="Heading"
            aria-pressed={activeFormats.heading}
          >
            <Type size={18} />
          </button>
          <button
            onClick={() => applyFormat("quote")}
            onMouseDown={(event) => event.preventDefault()}
            className={`flex items-center justify-center rounded p-2 transition-colors ${activeFormats.quote ? "bg-gray-700 text-pink-300" : "hover:bg-gray-700"}`}
            title="Quote"
            aria-label="Quote"
            aria-pressed={activeFormats.quote}
          >
            <Quote size={18} />
          </button>
          <button
            onClick={() => applyFormat("link")}
            onMouseDown={(event) => event.preventDefault()}
            className={`flex items-center justify-center rounded p-2 transition-colors ${activeFormats.link ? "bg-gray-700 text-pink-300" : "hover:bg-gray-700"}`}
            title="Link"
            aria-label="Link"
            aria-pressed={activeFormats.link}
          >
            <Link2 size={18} />
          </button>
          <div className="h-6 w-px bg-gray-700" />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => handleUndoRedo("undo")}
            className="flex items-center justify-center rounded p-2 transition-colors hover:bg-gray-700"
            title="Undo (Ctrl/Cmd + Z)"
            aria-label="Undo"
          >
            <Undo2 size={18} />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => handleUndoRedo("redo")}
            className="flex items-center justify-center rounded p-2 transition-colors hover:bg-gray-700"
            title="Redo (Ctrl/Cmd + Shift + Z)"
            aria-label="Redo"
          >
            <Redo2 size={18} />
          </button>
        </div>
      ) : null}

      {linkInput.visible ? (
        <div
          className="animate-fadeIn fixed z-[60] w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
          style={{ top: `${linkInput.top}px`, left: `${linkInput.left}px` }}
        >
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Insert Link
          </label>
          <input
            type="url"
            value={linkInput.url}
            onChange={(e) =>
              setLinkInput((prev) => ({ ...prev, url: e.target.value }))
            }
            placeholder="https://example.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none transition-all focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleLinkCancel}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLinkApply}
              className="rounded-lg bg-pink-300 px-3 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-pink-400"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}

      {isDiscardDialogOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Discard unsaved changes?</h2>
            <p className="mt-2 text-sm text-gray-600">Your blog draft has changes that have not been published. If you leave now, they will be lost.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsDiscardDialogOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Keep editing</button>
              <button type="button" onClick={() => navigate("/blog")} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Discard changes</button>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        [contenteditable] h3 {
          font-size: 1.875rem;
          font-weight: bold;
          margin: 1rem 0 0.5rem 0;
          line-height: 1.25;
        }
        [contenteditable] blockquote {
          border-left: 4px solid #f472b6;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #6b7280;
          font-style: italic;
        }
        [contenteditable] a {
          color: #3b82f6;
          text-decoration: underline;
          cursor: pointer;
        }
        [contenteditable] a:hover {
          color: #1d4ed8;
        }
      `}</style>
    </div>
  );
}

export default AddBlog;
