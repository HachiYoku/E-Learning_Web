import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, Italic, Link2, List, ListOrdered, Quote, Redo2, Table2, Type, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchBlogById, updateBlog } from "../../services/blogService";
import { validateFileSize } from "../../utils/fileValidation";

const TEXT_COLORS = [
  { name: "Black", value: "#111827" },
  { name: "Gray", value: "#6b7280" },
  { name: "Red", value: "#dc2626" },
  { name: "Orange", value: "#ea580c" },
  { name: "Yellow", value: "#ca8a04" },
  { name: "Green", value: "#16a34a" },
  { name: "Blue", value: "#2563eb" },
  { name: "Purple", value: "#9333ea" },
  { name: "Pink", value: "#db2777" },
  { name: "Teal", value: "#0f766e" },
];

function EditBlog() {
  const navigate = useNavigate();
  const { id } = useParams();
  const contentRef = useRef(null);
  const titleRef = useRef(null);
  const selectedRangeRef = useRef(null);
  const editorHistoryRef = useRef({ entries: [""], index: 0 });
  const initialFormRef = useRef("");
  const [blog, setBlog] = useState(null);
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fontSize, setFontSize] = useState(12);
  const [textColor, setTextColor] = useState("#111827");
  const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(false);
  const [tableDialog, setTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableColumns, setTableColumns] = useState(3);
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

  const getSelectedFontSize = () => {
    const selection = window.getSelection();
    const selectedNode = selection?.anchorNode;
    const selectedElement = selectedNode?.nodeType === 1 ? selectedNode : selectedNode?.parentElement;
    const formattedElement = selectedElement?.closest("span[style*='font-size'], h2, h3, h4");

    if (!formattedElement || !contentRef.current?.contains(formattedElement)) return 12;
    const size = Number.parseFloat(window.getComputedStyle(formattedElement).fontSize);
    return Number.isFinite(size) ? Math.round(size) : 12;
  };

  useEffect(() => {
    let isMounted = true;

    async function loadBlog() {
      try {
        setIsLoading(true);
        setError("");
        const data = await fetchBlogById(id);

        if (!isMounted) {
          return;
        }

        setBlog(data);
        setFormData({
          title: data.title,
          content: data.content,
          image: data.image,
          imageFile: null,
        });
        initialFormRef.current = getFormSnapshot({ ...data, imageFile: null });
        setIsEditorEmpty(!data.content.replace(/<[^>]*>/g, "").trim());
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || "Failed to load blog");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadBlog();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!contentRef.current) {
      return;
    }

    const nextContent = formData.content || "";

    if (contentRef.current.innerHTML !== nextContent) {
      contentRef.current.innerHTML = nextContent;
      editorHistoryRef.current = { entries: [formData.content || ""], index: 0 };
    }
  }, [formData.content]);

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

    if (selection?.anchorNode && contentRef.current?.contains(selection.anchorNode)) {
      setFontSize(getSelectedFontSize());
    }

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

  const saveEditorSelection = () => {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (range && contentRef.current?.contains(range.commonAncestorContainer) && selection.toString().trim()) {
      selectedRangeRef.current = range.cloneRange();
    }
  };

  const applyFontSize = (nextSize) => {
    const editor = contentRef.current;
    const selection = window.getSelection();
    if (!editor || !selectedRangeRef.current || !editor.contains(selectedRangeRef.current.commonAncestorContainer)) {
      setError("Select text before changing its size.");
      return;
    }

    editor.focus();
    selection?.removeAllRanges();
    selection?.addRange(selectedRangeRef.current);
    if (!selection?.toString().trim()) {
      setError("Select text before changing its size.");
      return;
    }

    const range = selection.getRangeAt(0);
    const wrapper = document.createElement("span");
    wrapper.style.fontSize = `${nextSize}px`;
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
    const updatedRange = document.createRange();
    updatedRange.selectNodeContents(wrapper);
    selection.removeAllRanges();
    selection.addRange(updatedRange);
    selectedRangeRef.current = updatedRange.cloneRange();
    setFontSize(nextSize);
    handleEditorChange();
    setError("");
  };

  const applyTextColor = (color) => {
    const editor = contentRef.current;
    const selection = window.getSelection();
    if (!editor || !selectedRangeRef.current || !editor.contains(selectedRangeRef.current.commonAncestorContainer)) {
      setError("Select text before changing its color.");
      return;
    }

    editor.focus();
    selection?.removeAllRanges();
    selection?.addRange(selectedRangeRef.current);
    if (!selection?.toString().trim()) {
      setError("Select text before changing its color.");
      return;
    }

    const range = selectedRangeRef.current;
    const wrapper = document.createElement("span");
    wrapper.style.color = color;
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
    const updatedRange = document.createRange();
    updatedRange.selectNodeContents(wrapper);
    selection.removeAllRanges();
    selection.addRange(updatedRange);
    selectedRangeRef.current = updatedRange.cloneRange();
    setTextColor(color);
    handleEditorChange();
    setError("");
  };

  const insertTable = () => {
    const safeRows = Math.min(Math.max(Number(tableRows) || 1, 1), 8);
    const safeColumns = Math.min(Math.max(Number(tableColumns) || 1, 1), 8);
    const headerCells = Array.from({ length: safeColumns }, () => "<th>Header</th>").join("");
    const bodyRows = Array.from({ length: Math.max(safeRows - 1, 0) }, () => (
      `<tr>${Array.from({ length: safeColumns }, () => "<td>Write here</td>").join("")}</tr>`
    )).join("");

    contentRef.current?.focus();
    document.execCommand("insertHTML", false, `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table><p><br></p>`);
    handleEditorChange();
    setTableDialog(false);
  };

  const applyFormat = (format) => {
    const editor = contentRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    if (selectedRangeRef.current && editor.contains(selectedRangeRef.current.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(selectedRangeRef.current);
    }
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
      case "bulletList":
        document.execCommand("insertUnorderedList", false, null);
        break;
      case "numberedList":
        document.execCommand("insertOrderedList", false, null);
        break;
      case "alignLeft":
        document.execCommand("justifyLeft", false, null);
        break;
      case "alignCenter":
        document.execCommand("justifyCenter", false, null);
        break;
      case "alignRight":
        document.execCommand("justifyRight", false, null);
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

    if (!formData.title.trim() || !plainText.trim()) {
      setError("Please fill in the title and content before updating.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await updateBlog(id, {
        title: formData.title.trim(),
        content: formData.content,
        image: blog?.image || "",
        imageFile: formData.imageFile,
      });
      initialFormRef.current = getFormSnapshot(formData);
      navigate("/blog");
    } catch (submitError) {
      setError(submitError.message || "Failed to update blog");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-gray-600">Loading blog...</div>;
  }

  if (!blog) {
    return <div className="flex h-screen items-center justify-center text-gray-600">Blog not found</div>;
  }

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
          <h1 className="flex-1 text-center text-2xl font-bold text-gray-900 sm:text-3xl md:text-4xl">Edit Blog</h1>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 rounded-lg bg-pink-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-pink-400 disabled:opacity-70 sm:flex-none sm:px-6">{isSubmitting ? "Updating..." : "Update"}</button>
          </div>
        </div>
      </div>

      <div className="flex flex-col p-4 sm:p-6 md:p-8">
        {error ? (
          <div className="mx-auto mb-6 max-w-6xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="order-2 mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 md:gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="lg:col-start-2">
            <label className="mb-3 block text-xs font-semibold text-gray-900 sm:text-sm md:mb-4">
              Blog image :
            </label>
            <div className="relative flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-5 transition-colors hover:bg-gray-100 group sm:min-h-64 sm:p-6">
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

          <div className="space-y-4 lg:col-start-1 lg:row-start-1">
            <textarea
              ref={titleRef}
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Blog title"
              rows={1}
              aria-label="Blog title"
              className="w-full min-h-[2.5rem] max-h-40 resize-none overflow-y-auto border-none bg-transparent p-0 text-2xl font-bold leading-tight text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0 sm:min-h-[3rem] sm:text-3xl md:text-4xl"
            />

            <div
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onMouseUp={handleTextSelection}
              onSelect={handleTextSelection}
              onKeyUp={handleTextSelection}
              onKeyDown={handleEditorKeyDown}
              onInput={handleEditorChange}
              data-placeholder="Start writing your blog..."
              className="blog-editor w-full overflow-y-auto whitespace-pre-wrap border-t border-gray-200 px-1 py-6 text-base leading-8 text-gray-700 outline-none focus:ring-0 sm:text-lg"
              style={{ minHeight: "680px" }}
            />
          </div>
        </div>

      <>
        <div
          onMouseDown={(event) => {
            if (event.target.closest("button")) {
              event.preventDefault();
              saveEditorSelection();
            }
          }}
          className="order-1 sticky top-0 z-10 mx-auto mb-5 flex w-full max-w-7xl flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white p-2 text-gray-700 shadow-[0_10px_30px_rgba(17,24,39,0.12)] sm:gap-2"
        >
          <button
            onClick={() => applyFormat("bold")}
            onMouseDown={(event) => event.preventDefault()}
            className={`flex items-center justify-center rounded p-2 transition-colors ${activeFormats.bold ? "bg-pink-100 text-pink-600" : "hover:bg-pink-50 hover:text-pink-600"}`}
            title="Bold"
            aria-label="Bold"
            aria-pressed={activeFormats.bold}
          >
            <Bold size={18} />
          </button>
          <button
            onClick={() => applyFormat("italic")}
            onMouseDown={(event) => event.preventDefault()}
            className={`flex items-center justify-center rounded p-2 transition-colors ${activeFormats.italic ? "bg-pink-100 text-pink-600" : "hover:bg-pink-50 hover:text-pink-600"}`}
            title="Italic"
            aria-label="Italic"
            aria-pressed={activeFormats.italic}
          >
            <Italic size={18} />
          </button>
          <div className="mx-1 h-6 w-px bg-gray-200" />
          <button
            onClick={() => applyFormat("heading")}
            onMouseDown={(event) => event.preventDefault()}
            className={`flex items-center justify-center rounded p-2 transition-colors ${activeFormats.heading ? "bg-pink-100 text-pink-600" : "hover:bg-pink-50 hover:text-pink-600"}`}
            title="Heading"
            aria-label="Heading"
            aria-pressed={activeFormats.heading}
          >
            <Type size={18} />
          </button>
          <button
            onClick={() => applyFormat("quote")}
            onMouseDown={(event) => event.preventDefault()}
            className={`flex items-center justify-center rounded p-2 transition-colors ${activeFormats.quote ? "bg-pink-100 text-pink-600" : "hover:bg-pink-50 hover:text-pink-600"}`}
            title="Quote"
            aria-label="Quote"
            aria-pressed={activeFormats.quote}
          >
            <Quote size={18} />
          </button>
          <button
            onClick={() => applyFormat("bulletList")}
            onMouseDown={(event) => event.preventDefault()}
            className="flex items-center justify-center rounded p-2 transition-colors hover:bg-pink-50 hover:text-pink-600"
            title="Bulleted list"
            aria-label="Bulleted list"
          >
            <List size={18} />
          </button>
          <button
            onClick={() => applyFormat("numberedList")}
            onMouseDown={(event) => event.preventDefault()}
            className="flex items-center justify-center rounded p-2 transition-colors hover:bg-pink-50 hover:text-pink-600"
            title="Numbered list"
            aria-label="Numbered list"
          >
            <ListOrdered size={18} />
          </button>
          <div className="flex h-9 items-center rounded border border-gray-200 bg-white" aria-label="Text size">
            <button type="button" onMouseDown={(event) => { event.preventDefault(); saveEditorSelection(); }} onClick={() => applyFontSize(Math.max(fontSize - 1, 8))} className="px-2 text-base font-semibold text-gray-500 hover:text-pink-600" aria-label="Decrease font size">-</button>
            <input type="number" min="8" max="72" value={fontSize} onChange={(event) => setFontSize(Math.min(Math.max(Number(event.target.value) || 8, 8), 72))} onKeyDown={(event) => event.key === "Enter" && applyFontSize(fontSize)} onMouseDown={saveEditorSelection} className="w-9 border-0 p-0 text-center text-xs font-bold text-gray-700 outline-none focus:ring-0" aria-label="Font size in pixels" />
            <button type="button" onMouseDown={(event) => { event.preventDefault(); saveEditorSelection(); }} onClick={() => applyFontSize(Math.min(fontSize + 1, 72))} className="px-2 text-base font-semibold text-gray-500 hover:text-pink-600" aria-label="Increase font size">+</button>
          </div>
          <div className="relative">
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setIsColorPaletteOpen((current) => !current)} className="flex h-9 items-center rounded border border-gray-200 bg-white px-2 text-sm font-bold text-gray-700 hover:border-pink-300" aria-label="Text color" aria-expanded={isColorPaletteOpen}>
              <span className="border-b-4 pb-0.5" style={{ borderColor: textColor }} aria-hidden="true">A</span>
            </button>
            {isColorPaletteOpen ? <div className="absolute left-0 top-11 z-30 grid w-44 grid-cols-5 gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-xl">{TEXT_COLORS.map((color) => <button key={color.value} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { applyTextColor(color.value); setIsColorPaletteOpen(false); }} className={`h-6 w-6 rounded-full border-2 border-white shadow ring-1 ring-gray-300 hover:scale-110 ${textColor === color.value ? "ring-2 ring-pink-500" : ""}`} style={{ backgroundColor: color.value }} title={color.name} aria-label={`${color.name} text`} />)}</div> : null}
          </div>
          <div className="mx-1 h-6 w-px bg-gray-200" />
          <button
            onClick={() => applyFormat("alignLeft")}
            onMouseDown={(event) => event.preventDefault()}
            className="flex items-center justify-center rounded p-2 transition-colors hover:bg-pink-50 hover:text-pink-600"
            title="Align left"
            aria-label="Align left"
          >
            <AlignLeft size={18} />
          </button>
          <button
            onClick={() => applyFormat("alignCenter")}
            onMouseDown={(event) => event.preventDefault()}
            className="flex items-center justify-center rounded p-2 transition-colors hover:bg-gray-700"
            title="Align center"
            aria-label="Align center"
          >
            <AlignCenter size={18} />
          </button>
          <button
            onClick={() => applyFormat("alignRight")}
            onMouseDown={(event) => event.preventDefault()}
            className="flex items-center justify-center rounded p-2 transition-colors hover:bg-gray-700"
            title="Align right"
            aria-label="Align right"
          >
            <AlignRight size={18} />
          </button>
          <button type="button" onClick={() => setTableDialog((current) => !current)} onMouseDown={(event) => event.preventDefault()} className="flex items-center justify-center rounded p-2 transition-colors hover:bg-pink-50 hover:text-pink-600" title="Insert table" aria-label="Insert table"><Table2 size={18} /></button>
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
          <div className="mx-1 h-6 w-px bg-gray-200" />
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
      </>

      {tableDialog ? (
        <div className="order-3 mx-auto mb-5 w-full max-w-7xl rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
          <p className="text-sm font-bold text-gray-800">Insert table</p>
          <div className="mt-3 grid max-w-sm grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-gray-600">Rows<input type="number" min="1" max="8" value={tableRows} onChange={(event) => setTableRows(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-2 text-sm text-gray-800" /></label>
            <label className="text-xs font-semibold text-gray-600">Columns<input type="number" min="1" max="8" value={tableColumns} onChange={(event) => setTableColumns(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-2 text-sm text-gray-800" /></label>
          </div>
          <div className="mt-4 flex gap-2"><button type="button" onClick={insertTable} className="rounded bg-pink-300 px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-pink-400">Insert table</button><button type="button" onClick={() => setTableDialog(false)} className="rounded px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200">Cancel</button></div>
        </div>
      ) : null}

      </div>

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
            <p className="mt-2 text-sm text-gray-600">Your edits have not been saved. If you leave now, they will be lost.</p>
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
        .blog-editor:empty::before {
          content: "Start writing your blog...";
          color: #9ca3af;
          pointer-events: none;
        }
        .blog-editor p { margin: 0 0 1rem; }
        .blog-editor ul, .blog-editor ol { margin: 1rem 0; padding-left: 1.5rem; }
        .blog-editor ul { list-style: disc; }
        .blog-editor ol { list-style: decimal; }
        .blog-editor h3 { margin: 1.75rem 0 0.75rem; font-size: 1.75rem; font-weight: 700; line-height: 1.25; color: #111827; }
        .blog-editor h4 { margin: 1rem 0 0.5rem; font-size: 1rem; font-weight: 600; }
        .blog-editor blockquote { margin: 1.5rem 0; border-left: 4px solid #f472b6; padding-left: 1rem; color: #6b7280; font-style: italic; }
        .blog-editor table { width: 100%; margin: 1.5rem 0; border-collapse: collapse; table-layout: fixed; }
        .blog-editor th, .blog-editor td { border: 1px solid #d1d5db; padding: 0.75rem; text-align: left; vertical-align: top; overflow-wrap: break-word; }
        .blog-editor th { background: #fdf2f8; font-weight: 700; }
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

export default EditBlog;
