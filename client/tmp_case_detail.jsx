import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/pages/CaseDetailPage.jsx");const useState = __vite__cjsImport0_react["useState"]; const useEffect = __vite__cjsImport0_react["useEffect"];const _jsxDEV = __vite__cjsImport8_react_jsxDevRuntime["jsxDEV"]; const _Fragment = __vite__cjsImport8_react_jsxDevRuntime["Fragment"];import __vite__cjsImport0_react from "/node_modules/.vite/deps/react.js?v=e9226179";
import { useParams, useNavigate } from "/node_modules/.vite/deps/react-router-dom.js?v=18f0554b";
import api from "/src/services/api.js";
import { useAuth } from "/src/context/AuthContext.jsx";
import toast from "/node_modules/.vite/deps/react-hot-toast.js?v=d6333637";
import { format } from "/node_modules/.vite/deps/date-fns.js?v=c3a8859a";
import { ArrowLeft, FileText, Lock, Send, User, Paperclip, Download, Edit3, Shield, AlertTriangle, Info, Zap, Upload } from "/node_modules/.vite/deps/lucide-react.js?v=5c406293";
import { COMPLIANCE_OFFICER_STATUSES, INVESTIGATOR_STATUSES, STATUS_BADGE, formatStatus } from "/src/constants/caseWorkflow.js";
var _jsxFileName = "C:/Users/Teyba/Desktop/DWBS system/client/src/pages/CaseDetailPage.jsx";
import __vite__cjsImport8_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=e9226179";
var _s = $RefreshSig$();
const PRIORITIES = [
	"Low",
	"Medium",
	"High",
	"Critical"
];
const PRIORITY_COLOR = {
	Low: "text-green-600",
	Medium: "text-yellow-600",
	High: "text-orange-600",
	Critical: "text-red-600"
};
export default function CaseDetailPage() {
	_s();
	const { id } = useParams();
	const navigate = useNavigate();
	const { user } = useAuth();
	const [caseData, setCaseData] = useState(null);
	const [notes, setNotes] = useState([]);
	const [evidence, setEvidence] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [noteBody, setNoteBody] = useState("");
	const [replyRecipient, setReplyRecipient] = useState("Investigator");
	const [showFullDescription, setShowFullDescription] = useState(false);
	const [isInternal, setIsInternal] = useState(false);
	const [sendingNote, setSendingNote] = useState(false);
	const [editMode, setEditMode] = useState(false);
	const [newStatus, setNewStatus] = useState("");
	const [newPriority, setNewPriority] = useState("");
	const [requestDescription, setRequestDescription] = useState("");
	const [requestBranch, setRequestBranch] = useState("");
	const [requestSeverity, setRequestSeverity] = useState("Medium");
	const [investigators, setInvestigators] = useState([]);
	const [assignTo, setAssignTo] = useState("");
	const [updating, setUpdating] = useState(false);
	const [uploadingEvidence, setUploadingEvidence] = useState(false);
	// ââ Per-spec permission flags âââââââââââââââââââââââââââââ
	// JWT payload uses `userId` (not `id`)
	const myUserId = user?.userId ?? user?.id;
	const isInvestigator = user?.role === "Investigator";
	const isSenior = user?.role === "Compliance_Officer";
	const isCEO = user?.role === "CEO";
	const isOwner = Boolean(caseData && caseData.owner_id === myUserId);
	const canManageOwnRequest = ["Employee", "Branch_Manager"].includes(user?.role) && isOwner && caseData?.submitted_by_type !== "anonymous";
	const canViewEvidence = ["Investigator", "Compliance_Officer"].includes(user?.role) || canManageOwnRequest;
	// Only Compliance_Officer / Team Lead can assign/reassign cases
	const canAssign = isSenior;
	// Investigators can ONLY edit cases explicitly assigned to them (assigned_to = their userId)
	const isAssignedToMe = caseData ? caseData.assigned_to === myUserId : false;
	const canEditNow = isSenior || isInvestigator && isAssignedToMe || canManageOwnRequest;
	const allowedStatusOptions = caseData ? [...new Set([caseData.status, ...isSenior ? COMPLIANCE_OFFICER_STATUSES : INVESTIGATOR_STATUSES])].filter(Boolean) : isSenior ? COMPLIANCE_OFFICER_STATUSES : INVESTIGATOR_STATUSES;
	const getNoteAuthorLabel = (note) => {
		if (note.author_type === "Compliance_Officer") return "Compliance Team Lead";
		if (note.author_type === "Investigator") return "Case Investigator";
		if (note.author_type === "Reporter") {
			return caseData?.submitted_by_type === "anonymous" ? "Anonymous Reporter" : "Staff Reporter";
		}
		return "Reporter";
	};
	const getNoteChannelLabel = (note) => {
		if (note.audience_type === "Compliance_Officer") return "Compliance Lead Thread";
		if (note.audience_type === "Investigator") return "Investigator Thread";
		return "General Thread";
	};
	const getNoteTone = (note) => {
		if (note.is_internal_only) {
			return {
				background: "rgba(139,92,246,0.06)",
				borderColor: "rgba(139,92,246,0.2)",
				labelColor: "#7c3aed",
				icon: "internal"
			};
		}
		if (note.author_type === "Compliance_Officer") {
			return {
				background: "rgba(37,99,235,0.06)",
				borderColor: "rgba(37,99,235,0.18)",
				labelColor: "#1d4ed8",
				icon: "staff"
			};
		}
		if (note.author_type === "Investigator") {
			return {
				background: "rgba(10,29,55,0.05)",
				borderColor: "rgba(10,29,55,0.1)",
				labelColor: "var(--color-navy-900)",
				icon: "staff"
			};
		}
		return {
			background: "rgba(249,168,38,0.07)",
			borderColor: "rgba(249,168,38,0.2)",
			labelColor: "var(--color-gold-700)",
			icon: "reporter"
		};
	};
	useEffect(() => {
		loadCase();
	}, [id]);
	const loadCase = async () => {
		setLoading(true);
		setError(null);
		try {
			// Case detail + notes in parallel
			const [cRes, nRes] = await Promise.all([api.get(`/cases/${id}`), api.get(`/cases/${id}/notes`)]);
			const c = cRes.data.case;
			setCaseData(c);
			setNotes(nRes.data.notes || []);
			// Validate status is in allowed list for this user's role
			const allowedStatuses = isSenior ? COMPLIANCE_OFFICER_STATUSES : INVESTIGATOR_STATUSES;
			setNewStatus(c.status || allowedStatuses[0]);
			setNewPriority(c.priority || "Medium");
			setRequestDescription(c.description || "");
			setRequestBranch(c.incident_location || "");
			setRequestSeverity(c.priority || "Medium");
			setAssignTo(c.assigned_to?.toString() || "");
			// Evidence â only for privileged roles
			if (canViewEvidence) {
				try {
					const eRes = await api.get(`/cases/${id}/evidence`);
					setEvidence(eRes.data.evidence || []);
				} catch (_) {
					setEvidence([]);
				}
			}
			// Investigator list â only for those who can assign
			if (canAssign) {
				try {
					const uRes = await api.get("/users");
					const inv = (uRes.data.users || []).filter((u) => ["Investigator", "Compliance_Officer"].includes(u.role)).sort((a, b) => (a.username || "").localeCompare(b.username || ""));
					setInvestigators(inv);
				} catch (err) {
					console.warn("Failed to load investigators:", err.message);
					setInvestigators([]);
				}
			}
		} catch (err) {
			const msg = err.response?.data?.error || "Failed to load case";
			setError(msg);
			toast.error(msg);
		}
		setLoading(false);
	};
	const sendNote = async () => {
		if (!noteBody.trim()) return;
		setSendingNote(true);
		try {
			await api.post(`/cases/${id}/notes`, {
				body: noteBody,
				is_internal_only: isInternal,
				recipient_role: canManageOwnRequest ? replyRecipient : undefined
			});
			setNoteBody("");
			const res = await api.get(`/cases/${id}/notes`);
			setNotes(res.data.notes || []);
			toast.success("Note added");
		} catch (err) {
			toast.error(err.response?.data?.error || "Failed to send note");
		}
		setSendingNote(false);
	};
	const downloadEvidence = async (fileId, filename) => {
		try {
			const response = await api.get(`/cases/${id}/evidence/${fileId}/download`, { responseType: "blob" });
			const mime = response.headers["content-type"] || response.headers["Content-Type"] || "";
			const blob = new Blob([response.data], { type: mime });
			// If the server returned JSON (error payload) as a blob, parse and display the error
			if (mime.includes("application/json")) {
				try {
					const text = await blob.text();
					const parsed = JSON.parse(text);
					toast.error(parsed.error || "Download failed");
					return;
				} catch (_) {
					toast.error("Download failed");
					return;
				}
			}
			const url = window.URL.createObjectURL(blob);
			// Preview inline for images, video, and PDFs; otherwise force download
			if (mime.startsWith("image/") || mime.startsWith("video/") || mime === "application/pdf") {
				// Open in new tab for preview
				window.open(url, "_blank");
			} else {
				const link = document.createElement("a");
				link.href = url;
				link.download = filename;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				window.URL.revokeObjectURL(url);
			}
		} catch (err) {
			toast.error(err.response?.data?.error || "Download failed");
			console.error("Download error:", err);
		}
	};
	const updateCase = async () => {
		setUpdating(true);
		try {
			const body = {};
			if (canManageOwnRequest) {
				body.description = requestDescription;
				body.branch_or_dept = requestBranch;
				body.severity_level = requestSeverity;
			} else {
				body.status = newStatus;
				body.priority = newPriority;
				if (assignTo) body.assigned_to = parseInt(assignTo, 10);
			}
			await api.patch(`/cases/${id}`, body);
			await loadCase();
			setEditMode(false);
			toast.success("Case updated successfully");
		} catch (err) {
			const msg = err.response?.data?.error || err.message || "Update failed";
			toast.error(msg);
			console.error("Update failed:", err);
		}
		setUpdating(false);
		;
	};
	const uploadEvidence = async (event) => {
		const file = event.target.files?.[0];
		if (!file) return;
		setUploadingEvidence(true);
		const formData = new FormData();
		formData.append("file", file);
		try {
			await api.post(`/cases/${id}/evidence`, formData, { headers: { "Content-Type": "multipart/form-data" } });
			await loadCase();
			toast.success("Additional evidence uploaded");
		} catch (err) {
			toast.error(err.response?.data?.error || "Evidence upload failed");
		} finally {
			setUploadingEvidence(false);
			event.target.value = "";
		}
	};
	const deleteCaseRequest = async () => {
		const justification = window.prompt("Please provide a justification for deleting this request (10+ characters):");
		if (!justification || justification.trim().length < 10) {
			toast.error("A justification of at least 10 characters is required.");
			return;
		}
		try {
			await api.delete(`/cases/${id}`, { data: {
				justification,
				requires_approval: false
			} });
			toast.success("Request deleted successfully");
			navigate("/dashboard");
		} catch (err) {
			toast.error(err.response?.data?.error || "Delete failed");
		}
	};
	// ââ Loading / Error states ââââââââââââââââââââââââââââââââ
	if (user?.role === "System_Admin") {
		return /* @__PURE__ */ _jsxDEV("div", {
			className: "p-6 max-w-2xl mx-auto text-center py-20 fade-in-up",
			children: /* @__PURE__ */ _jsxDEV("div", {
				className: "card p-8 border border-red-100 shadow-sm",
				children: [
					/* @__PURE__ */ _jsxDEV(Lock, {
						size: 48,
						className: "mx-auto mb-4 text-red-500"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 310,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ _jsxDEV("h2", {
						className: "text-xl font-bold text-slate-800 mb-2",
						children: "Ethical Wall - Access Denied"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 311,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ _jsxDEV("p", {
						className: "text-slate-500 text-sm mb-6",
						children: "System Administrators are strictly prohibited from viewing case contents, notes, or evidence."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 312,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ _jsxDEV("button", {
						onClick: () => navigate(-1),
						className: "btn btn-primary",
						children: "Go Back"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 315,
						columnNumber: 11
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 309,
				columnNumber: 9
			}, this)
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 308,
			columnNumber: 7
		}, this);
	}
	if (loading) {
		return /* @__PURE__ */ _jsxDEV("div", {
			className: "flex items-center justify-center h-96",
			children: /* @__PURE__ */ _jsxDEV("div", {
				className: "text-center",
				children: [/* @__PURE__ */ _jsxDEV("span", { className: "spinner spinner-navy" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 325,
					columnNumber: 11
				}, this), /* @__PURE__ */ _jsxDEV("p", {
					className: "text-sm text-slate-400 mt-3",
					children: "Loading case details..."
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 326,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 324,
				columnNumber: 9
			}, this)
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 323,
			columnNumber: 7
		}, this);
	}
	if (error || !caseData) {
		return /* @__PURE__ */ _jsxDEV("div", {
			className: "p-6 max-w-2xl mx-auto",
			children: [/* @__PURE__ */ _jsxDEV("button", {
				onClick: () => navigate(-1),
				className: "btn btn-ghost mb-6",
				children: [/* @__PURE__ */ _jsxDEV(ArrowLeft, { size: 16 }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 336,
					columnNumber: 11
				}, this), " Back"]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 335,
				columnNumber: 9
			}, this), /* @__PURE__ */ _jsxDEV("div", {
				className: "card p-8 text-center",
				children: [
					/* @__PURE__ */ _jsxDEV(AlertTriangle, {
						size: 40,
						className: "mx-auto mb-3 text-red-400"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 339,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ _jsxDEV("p", {
						className: "text-lg font-semibold text-slate-700 mb-1",
						children: "Failed to Load Case"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 340,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ _jsxDEV("p", {
						className: "text-sm text-slate-400 mb-4",
						children: error || "Case not found or access denied."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 341,
						columnNumber: 11
					}, this),
					/* @__PURE__ */ _jsxDEV("button", {
						onClick: loadCase,
						className: "btn btn-primary",
						children: "Try Again"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 342,
						columnNumber: 11
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 338,
				columnNumber: 9
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 334,
			columnNumber: 7
		}, this);
	}
	return /* @__PURE__ */ _jsxDEV("div", {
		className: "p-6 max-w-5xl mx-auto fade-in-up",
		children: [/* @__PURE__ */ _jsxDEV("button", {
			onClick: () => navigate(-1),
			className: "btn btn-ghost mb-6 -ml-2",
			children: [/* @__PURE__ */ _jsxDEV(ArrowLeft, { size: 16 }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 353,
				columnNumber: 9
			}, this), " Back to Cases"]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 352,
			columnNumber: 7
		}, this), /* @__PURE__ */ _jsxDEV("div", {
			className: "grid lg:grid-cols-3 gap-6",
			children: [/* @__PURE__ */ _jsxDEV("div", {
				className: "lg:col-span-2 space-y-6",
				children: [/* @__PURE__ */ _jsxDEV("div", {
					className: "card p-6",
					children: [
						/* @__PURE__ */ _jsxDEV("div", {
							className: "flex items-start justify-between gap-4 mb-4",
							children: [/* @__PURE__ */ _jsxDEV("div", { children: [/* @__PURE__ */ _jsxDEV("p", {
								className: "text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1",
								children: "Reference Code"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 365,
								columnNumber: 17
							}, this), /* @__PURE__ */ _jsxDEV("h1", {
								className: "text-2xl font-mono font-bold tracking-widest",
								style: { color: "var(--color-navy-900)" },
								children: caseData.reference_id
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 368,
								columnNumber: 17
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 364,
								columnNumber: 15
							}, this), /* @__PURE__ */ _jsxDEV("span", {
								className: `badge ${STATUS_BADGE[caseData.status] || "badge-review"} text-sm`,
								children: formatStatus(caseData.status)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 373,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 363,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ _jsxDEV("div", {
							className: "grid grid-cols-2 gap-3 mb-5",
							children: [
								["Category", caseData.category?.replace(/_/g, " ")],
								["Priority", caseData.priority],
								["Submitted By", caseData.submitted_by_type === "anonymous" ? "ð Anonymous" : "ð¤ Staff"],
								["Date Submitted", format(new Date(caseData.created_at), "MMM d, yyyy HH:mm")],
								caseData.incident_location && ["Location", caseData.incident_location],
								["Last Updated", format(new Date(caseData.updated_at), "MMM d, yyyy HH:mm")]
							].filter(Boolean).map(([label, value]) => /* @__PURE__ */ _jsxDEV("div", {
								className: "p-3 rounded-lg",
								style: { background: "var(--color-slate-50)" },
								children: [/* @__PURE__ */ _jsxDEV("p", {
									className: "text-xs text-slate-400 mb-0.5",
									children: label
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 388,
									columnNumber: 19
								}, this), /* @__PURE__ */ _jsxDEV("p", {
									className: `text-sm font-semibold ${label === "Priority" ? PRIORITY_COLOR[value] : "text-slate-700"}`,
									children: value
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 389,
									columnNumber: 19
								}, this)]
							}, label, true, {
								fileName: _jsxFileName,
								lineNumber: 387,
								columnNumber: 17
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 378,
							columnNumber: 13
						}, this),
						caseData.description && /* @__PURE__ */ _jsxDEV("div", { children: [/* @__PURE__ */ _jsxDEV("p", {
							className: "text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2",
							children: "Report Description"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 399,
							columnNumber: 17
						}, this), /* @__PURE__ */ _jsxDEV("div", {
							className: "bg-slate-50 rounded-xl p-4",
							children: [/* @__PURE__ */ _jsxDEV("p", {
								className: `text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words ${showFullDescription ? "max-h-[none]" : "max-h-40"} overflow-auto`,
								style: { wordBreak: "break-word" },
								children: caseData.description
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 405,
								columnNumber: 19
							}, this), String(caseData.description).length > 300 && /* @__PURE__ */ _jsxDEV("div", {
								className: "mt-2 text-right",
								children: /* @__PURE__ */ _jsxDEV("button", {
									onClick: () => setShowFullDescription((s) => !s),
									className: "text-xs font-semibold text-navy-900 underline",
									children: showFullDescription ? "Show less" : "Show more"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 417,
									columnNumber: 23
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 416,
								columnNumber: 21
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 404,
							columnNumber: 17
						}, this)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 398,
							columnNumber: 15
						}, this),
						isInvestigator && !isAssignedToMe && /* @__PURE__ */ _jsxDEV("div", {
							className: "mt-4 p-3 rounded-lg flex items-start gap-2 bg-amber-50 border border-amber-200",
							children: [/* @__PURE__ */ _jsxDEV(Info, {
								size: 14,
								className: "text-amber-600 flex-shrink-0 mt-0.5"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 432,
								columnNumber: 17
							}, this), /* @__PURE__ */ _jsxDEV("p", {
								className: "text-xs text-amber-800",
								children: caseData.assigned_to === null ? "This case is unassigned. A Compliance Officer must assign it to you before you can make changes." : "This case belongs to another investigator. You can view it but cannot make changes."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 433,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 431,
							columnNumber: 15
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 362,
					columnNumber: 11
				}, this), /* @__PURE__ */ _jsxDEV("div", {
					className: "card p-6",
					children: [
						/* @__PURE__ */ _jsxDEV("h2", {
							className: "text-sm font-bold mb-4",
							style: { color: "var(--color-navy-900)" },
							children: "Correspondence & Notes"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 444,
							columnNumber: 13
						}, this),
						/* @__PURE__ */ _jsxDEV("div", {
							className: "space-y-3 mb-6 max-h-96 overflow-y-auto pr-1",
							children: notes.length === 0 ? /* @__PURE__ */ _jsxDEV("p", {
								className: "text-sm text-slate-400 text-center py-6",
								children: "No notes yet."
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 450,
								columnNumber: 17
							}, this) : notes.map((n, i) => {
								const tone = getNoteTone(n);
								return /* @__PURE__ */ _jsxDEV("div", {
									className: `p-4 rounded-xl ${n.author_type === "Reporter" ? "ml-6" : ""}`,
									style: {
										background: tone.background,
										border: "1px solid",
										borderColor: tone.borderColor
									},
									children: [/* @__PURE__ */ _jsxDEV("div", {
										className: "flex items-center justify-between mb-2 gap-2",
										children: [/* @__PURE__ */ _jsxDEV("div", {
											className: "flex items-center gap-2",
											children: [
												tone.icon === "staff" ? /* @__PURE__ */ _jsxDEV(User, {
													size: 12,
													className: "text-slate-400"
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 464,
													columnNumber: 27
												}, this) : /* @__PURE__ */ _jsxDEV(Shield, {
													size: 12,
													style: { color: "var(--color-gold-500)" }
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 465,
													columnNumber: 27
												}, this),
												/* @__PURE__ */ _jsxDEV("span", {
													className: "text-xs font-semibold",
													style: { color: tone.labelColor },
													children: getNoteAuthorLabel(n)
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 466,
													columnNumber: 23
												}, this),
												n.audience_type && /* @__PURE__ */ _jsxDEV("span", {
													className: "text-xs px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-500",
													children: getNoteChannelLabel(n)
												}, void 0, false, {
													fileName: _jsxFileName,
													lineNumber: 470,
													columnNumber: 25
												}, this),
												n.is_internal_only === 1 && /* @__PURE__ */ _jsxDEV("span", {
													className: "text-xs px-1.5 py-0.5 rounded font-medium",
													style: {
														background: "rgba(139,92,246,0.12)",
														color: "#7c3aed"
													},
													children: [/* @__PURE__ */ _jsxDEV(Lock, {
														size: 9,
														className: "inline mr-0.5"
													}, void 0, false, {
														fileName: _jsxFileName,
														lineNumber: 477,
														columnNumber: 27
													}, this), "Internal Only"]
												}, void 0, true, {
													fileName: _jsxFileName,
													lineNumber: 475,
													columnNumber: 25
												}, this)
											]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 462,
											columnNumber: 21
										}, this), /* @__PURE__ */ _jsxDEV("span", {
											className: "text-xs text-slate-400",
											children: format(new Date(n.created_at), "MMM d, HH:mm")
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 481,
											columnNumber: 21
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 461,
										columnNumber: 19
									}, this), /* @__PURE__ */ _jsxDEV("p", {
										className: "text-sm text-slate-700 leading-relaxed",
										children: n.body
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 485,
										columnNumber: 19
									}, this)]
								}, n.id || i, true, {
									fileName: _jsxFileName,
									lineNumber: 454,
									columnNumber: 17
								}, this);
							})
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 448,
							columnNumber: 13
						}, this),
						canEditNow && /* @__PURE__ */ _jsxDEV("div", {
							className: "border-t border-slate-100 pt-4",
							children: [
								/* @__PURE__ */ _jsxDEV("textarea", {
									className: "form-textarea mb-3",
									rows: 3,
									placeholder: isInvestigator ? "Add an internal note or send a message to the reporter..." : "Add a note...",
									value: noteBody,
									onChange: (e) => setNoteBody(e.target.value)
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 494,
									columnNumber: 17
								}, this),
								canManageOwnRequest && /* @__PURE__ */ _jsxDEV("div", {
									className: "mb-3",
									children: [/* @__PURE__ */ _jsxDEV("label", {
										className: "form-label text-xs",
										children: "Reply To"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 505,
										columnNumber: 21
									}, this), /* @__PURE__ */ _jsxDEV("select", {
										className: "form-select text-sm",
										value: replyRecipient,
										onChange: (e) => setReplyRecipient(e.target.value),
										children: [/* @__PURE__ */ _jsxDEV("option", {
											value: "Investigator",
											children: "Case Investigator"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 511,
											columnNumber: 23
										}, this), /* @__PURE__ */ _jsxDEV("option", {
											value: "Compliance_Officer",
											children: "Compliance Team Lead"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 512,
											columnNumber: 23
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 506,
										columnNumber: 21
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 504,
									columnNumber: 19
								}, this),
								/* @__PURE__ */ _jsxDEV("div", {
									className: "flex items-center justify-between gap-3",
									children: [/* @__PURE__ */ _jsxDEV("label", {
										className: "flex items-center gap-2 cursor-pointer",
										children: [/* @__PURE__ */ _jsxDEV("input", {
											type: "checkbox",
											checked: isInternal,
											onChange: (e) => setIsInternal(e.target.checked),
											className: "w-4 h-4 rounded"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 518,
											columnNumber: 21
										}, this), /* @__PURE__ */ _jsxDEV("span", {
											className: "text-xs text-slate-500 flex items-center gap-1",
											children: [/* @__PURE__ */ _jsxDEV(Lock, { size: 11 }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 525,
												columnNumber: 23
											}, this), " Internal note only (hidden from reporter)"]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 524,
											columnNumber: 21
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 517,
										columnNumber: 19
									}, this), /* @__PURE__ */ _jsxDEV("button", {
										onClick: sendNote,
										disabled: sendingNote || !noteBody.trim(),
										className: "btn btn-primary text-sm",
										children: [sendingNote ? /* @__PURE__ */ _jsxDEV("span", { className: "spinner" }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 533,
											columnNumber: 36
										}, this) : /* @__PURE__ */ _jsxDEV(Send, { size: 14 }, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 533,
											columnNumber: 67
										}, this), "Send"]
									}, void 0, true, {
										fileName: _jsxFileName,
										lineNumber: 528,
										columnNumber: 19
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 516,
									columnNumber: 17
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 493,
							columnNumber: 15
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 443,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 359,
				columnNumber: 9
			}, this), /* @__PURE__ */ _jsxDEV("div", {
				className: "space-y-5",
				children: [
					canEditNow && /* @__PURE__ */ _jsxDEV("div", {
						className: "card p-5",
						children: [/* @__PURE__ */ _jsxDEV("div", {
							className: "flex items-center justify-between mb-4",
							children: [/* @__PURE__ */ _jsxDEV("h3", {
								className: "text-sm font-bold",
								style: { color: "var(--color-navy-900)" },
								children: "Case Actions"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 549,
								columnNumber: 17
							}, this), /* @__PURE__ */ _jsxDEV("button", {
								onClick: () => setEditMode((e) => !e),
								className: "btn btn-ghost text-xs py-1 px-2",
								children: [
									/* @__PURE__ */ _jsxDEV(Edit3, { size: 12 }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 556,
										columnNumber: 19
									}, this),
									" ",
									editMode ? "Cancel" : "Edit"
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 552,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 548,
							columnNumber: 15
						}, this), editMode ? /* @__PURE__ */ _jsxDEV("div", {
							className: "space-y-3",
							children: [canManageOwnRequest ? /* @__PURE__ */ _jsxDEV(_Fragment, { children: [/* @__PURE__ */ _jsxDEV("div", { children: [/* @__PURE__ */ _jsxDEV("label", {
								className: "form-label text-xs",
								children: "Description"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 565,
								columnNumber: 25
							}, this), /* @__PURE__ */ _jsxDEV("textarea", {
								className: "form-textarea text-sm",
								rows: 4,
								value: requestDescription,
								onChange: (e) => setRequestDescription(e.target.value)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 566,
								columnNumber: 25
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 564,
								columnNumber: 23
							}, this), /* @__PURE__ */ _jsxDEV("div", { children: [/* @__PURE__ */ _jsxDEV("label", {
								className: "form-label text-xs",
								children: "Branch / Department"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 574,
								columnNumber: 25
							}, this), /* @__PURE__ */ _jsxDEV("input", {
								type: "text",
								className: "form-input text-sm",
								value: requestBranch,
								onChange: (e) => setRequestBranch(e.target.value)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 575,
								columnNumber: 25
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 573,
								columnNumber: 23
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 563,
								columnNumber: 21
							}, this) : /* @__PURE__ */ _jsxDEV(_Fragment, { children: [
								/* @__PURE__ */ _jsxDEV("div", { children: [/* @__PURE__ */ _jsxDEV("label", {
									className: "form-label text-xs",
									children: "Status"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 586,
									columnNumber: 25
								}, this), /* @__PURE__ */ _jsxDEV("select", {
									className: "form-select text-sm",
									value: newStatus,
									onChange: (e) => setNewStatus(e.target.value),
									children: allowedStatusOptions.map((s) => /* @__PURE__ */ _jsxDEV("option", {
										value: s,
										children: formatStatus(s)
									}, s, false, {
										fileName: _jsxFileName,
										lineNumber: 593,
										columnNumber: 29
									}, this))
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 587,
									columnNumber: 25
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 585,
									columnNumber: 23
								}, this),
								/* @__PURE__ */ _jsxDEV("div", { children: [/* @__PURE__ */ _jsxDEV("div", {
									className: "flex items-center justify-between mb-1",
									children: [/* @__PURE__ */ _jsxDEV("label", {
										className: "form-label text-xs",
										children: "Severity / Priority"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 599,
										columnNumber: 27
									}, this), /* @__PURE__ */ _jsxDEV("span", {
										className: "text-xs text-slate-400",
										children: "(Compliance Officer only)"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 600,
										columnNumber: 27
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 598,
									columnNumber: 25
								}, this), isSenior ? /* @__PURE__ */ _jsxDEV(_Fragment, { children: [/* @__PURE__ */ _jsxDEV("select", {
									className: "form-select text-sm",
									value: newPriority,
									onChange: (e) => setNewPriority(e.target.value),
									children: PRIORITIES.map((p) => /* @__PURE__ */ _jsxDEV("option", {
										value: p,
										children: p
									}, p, false, {
										fileName: _jsxFileName,
										lineNumber: 610,
										columnNumber: 33
									}, this))
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 604,
									columnNumber: 29
								}, this), newPriority === "Critical" && !caseData.is_escalated && /* @__PURE__ */ _jsxDEV("p", {
									className: "text-xs text-amber-600 mt-1 flex items-center gap-1",
									children: [/* @__PURE__ */ _jsxDEV(Zap, { size: 12 }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 615,
										columnNumber: 33
									}, this), " Setting to Critical will escalate to CEO"]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 614,
									columnNumber: 31
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 603,
									columnNumber: 27
								}, this) : /* @__PURE__ */ _jsxDEV("div", {
									className: "text-sm font-semibold",
									children: caseData.priority
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 620,
									columnNumber: 27
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 597,
									columnNumber: 23
								}, this),
								canAssign && /* @__PURE__ */ _jsxDEV("div", { children: [/* @__PURE__ */ _jsxDEV("label", {
									className: "form-label text-xs",
									children: "Assign To"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 625,
									columnNumber: 27
								}, this), /* @__PURE__ */ _jsxDEV("select", {
									className: "form-select text-sm",
									value: assignTo,
									onChange: (e) => setAssignTo(e.target.value),
									children: [/* @__PURE__ */ _jsxDEV("option", {
										value: "",
										children: caseData.assigned_investigator ? "Reassign..." : "Assign investigator"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 631,
										columnNumber: 29
									}, this), investigators.length > 0 ? investigators.map((u) => /* @__PURE__ */ _jsxDEV("option", {
										value: u.id,
										children: u.username
									}, u.id, false, {
										fileName: _jsxFileName,
										lineNumber: 633,
										columnNumber: 31
									}, this)) : /* @__PURE__ */ _jsxDEV("option", {
										disabled: true,
										children: "No investigators"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 637,
										columnNumber: 31
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 626,
									columnNumber: 27
								}, this)] }, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 624,
									columnNumber: 25
								}, this)
							] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 584,
								columnNumber: 21
							}, this), /* @__PURE__ */ _jsxDEV("button", {
								onClick: updateCase,
								disabled: updating,
								className: "btn btn-gold w-full text-sm",
								children: [updating ? /* @__PURE__ */ _jsxDEV("span", { className: "spinner spinner-navy" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 650,
									columnNumber: 33
								}, this) : null, "Save Changes"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 645,
								columnNumber: 19
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 561,
							columnNumber: 17
						}, this) : /* @__PURE__ */ _jsxDEV("div", {
							className: "space-y-2 text-sm",
							children: [
								caseData.is_escalated && /* @__PURE__ */ _jsxDEV("div", {
									className: "flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-md mb-2",
									children: [/* @__PURE__ */ _jsxDEV(Zap, {
										size: 14,
										className: "text-red-600"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 658,
										columnNumber: 23
									}, this), /* @__PURE__ */ _jsxDEV("span", {
										className: "text-xs font-semibold text-red-700",
										children: "Escalated to CEO"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 659,
										columnNumber: 23
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 657,
									columnNumber: 21
								}, this),
								/* @__PURE__ */ _jsxDEV("div", {
									className: "flex justify-between items-center",
									children: [/* @__PURE__ */ _jsxDEV("span", {
										className: "text-slate-500",
										children: "Status"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 663,
										columnNumber: 21
									}, this), /* @__PURE__ */ _jsxDEV("span", {
										className: `badge ${STATUS_BADGE[caseData.status] || "badge-review"}`,
										children: formatStatus(caseData.status)
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 664,
										columnNumber: 21
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 662,
									columnNumber: 19
								}, this),
								/* @__PURE__ */ _jsxDEV("div", {
									className: "flex justify-between items-center",
									children: [/* @__PURE__ */ _jsxDEV("span", {
										className: "text-slate-500",
										children: "Priority"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 669,
										columnNumber: 21
									}, this), /* @__PURE__ */ _jsxDEV("span", {
										className: `font-semibold text-sm ${PRIORITY_COLOR[caseData.priority]}`,
										children: caseData.priority
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 670,
										columnNumber: 21
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 668,
									columnNumber: 19
								}, this),
								/* @__PURE__ */ _jsxDEV("div", {
									className: "flex justify-between items-center",
									children: [/* @__PURE__ */ _jsxDEV("span", {
										className: "text-slate-500",
										children: "Assigned To"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 675,
										columnNumber: 21
									}, this), /* @__PURE__ */ _jsxDEV("span", {
										className: "font-semibold text-slate-700 text-xs text-right",
										children: caseData.assigned_investigator || "Unassigned"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 676,
										columnNumber: 21
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName,
									lineNumber: 674,
									columnNumber: 19
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 655,
							columnNumber: 17
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 547,
						columnNumber: 13
					}, this),
					canManageOwnRequest && /* @__PURE__ */ _jsxDEV("div", {
						className: "card p-5",
						children: [/* @__PURE__ */ _jsxDEV("h3", {
							className: "text-sm font-bold mb-3",
							style: { color: "var(--color-navy-900)" },
							children: "Manage Request"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 687,
							columnNumber: 15
						}, this), /* @__PURE__ */ _jsxDEV("button", {
							onClick: deleteCaseRequest,
							className: "btn btn-ghost w-full text-sm mb-3",
							children: "Delete Request"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 690,
							columnNumber: 15
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 686,
						columnNumber: 13
					}, this),
					canViewEvidence && /* @__PURE__ */ _jsxDEV("div", {
						className: "card p-5",
						children: [
							/* @__PURE__ */ _jsxDEV("h3", {
								className: "text-sm font-bold mb-3 flex items-center gap-2",
								style: { color: "var(--color-navy-900)" },
								children: [
									/* @__PURE__ */ _jsxDEV(Paperclip, { size: 14 }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 701,
										columnNumber: 17
									}, this),
									" Evidence Files (",
									evidence.length,
									")"
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 699,
								columnNumber: 15
							}, this),
							(canManageOwnRequest || isAssignedToMe || isSenior) && /* @__PURE__ */ _jsxDEV("label", {
								className: "btn btn-outline w-full text-xs mb-3 cursor-pointer",
								children: [
									uploadingEvidence ? /* @__PURE__ */ _jsxDEV("span", { className: "spinner" }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 705,
										columnNumber: 40
									}, this) : /* @__PURE__ */ _jsxDEV(Upload, { size: 13 }, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 705,
										columnNumber: 71
									}, this),
									uploadingEvidence ? "Uploading..." : "Add Evidence",
									/* @__PURE__ */ _jsxDEV("input", {
										type: "file",
										className: "hidden",
										disabled: uploadingEvidence,
										onChange: uploadEvidence,
										accept: ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
									}, void 0, false, {
										fileName: _jsxFileName,
										lineNumber: 707,
										columnNumber: 19
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 704,
								columnNumber: 17
							}, this),
							evidence.length === 0 ? /* @__PURE__ */ _jsxDEV("p", {
								className: "text-xs text-slate-400 text-center py-3",
								children: "No evidence attached"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 717,
								columnNumber: 17
							}, this) : /* @__PURE__ */ _jsxDEV("ul", {
								className: "space-y-2",
								children: evidence.map((f) => /* @__PURE__ */ _jsxDEV("li", {
									className: "flex items-center gap-2 p-2 rounded-lg",
									style: { background: "var(--color-slate-50)" },
									children: [
										/* @__PURE__ */ _jsxDEV(FileText, {
											size: 14,
											className: "text-slate-400 flex-shrink-0"
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 724,
											columnNumber: 23
										}, this),
										/* @__PURE__ */ _jsxDEV("div", {
											className: "flex-1 overflow-hidden",
											children: [/* @__PURE__ */ _jsxDEV("p", {
												className: "text-xs font-medium text-slate-700 truncate",
												children: f.original_filename
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 726,
												columnNumber: 25
											}, this), /* @__PURE__ */ _jsxDEV("p", {
												className: "text-xs text-slate-400",
												children: format(new Date(f.uploaded_at), "MMM d, yyyy")
											}, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 729,
												columnNumber: 25
											}, this)]
										}, void 0, true, {
											fileName: _jsxFileName,
											lineNumber: 725,
											columnNumber: 23
										}, this),
										/* @__PURE__ */ _jsxDEV("a", {
											onClick: () => downloadEvidence(f.id, f.original_filename),
											className: "text-slate-400 hover:text-navy-900 transition-colors cursor-pointer",
											children: /* @__PURE__ */ _jsxDEV(Download, { size: 13 }, void 0, false, {
												fileName: _jsxFileName,
												lineNumber: 737,
												columnNumber: 25
											}, this)
										}, void 0, false, {
											fileName: _jsxFileName,
											lineNumber: 733,
											columnNumber: 23
										}, this)
									]
								}, f.id, true, {
									fileName: _jsxFileName,
									lineNumber: 721,
									columnNumber: 21
								}, this))
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 719,
								columnNumber: 17
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 698,
						columnNumber: 13
					}, this),
					/* @__PURE__ */ _jsxDEV("div", {
						className: "card p-5",
						children: [/* @__PURE__ */ _jsxDEV("h3", {
							className: "text-sm font-bold mb-3",
							style: { color: "var(--color-navy-900)" },
							children: "Timeline"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 748,
							columnNumber: 13
						}, this), /* @__PURE__ */ _jsxDEV("div", {
							className: "space-y-2 text-xs text-slate-500",
							children: [/* @__PURE__ */ _jsxDEV("div", {
								className: "flex justify-between",
								children: [/* @__PURE__ */ _jsxDEV("span", { children: "Created" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 753,
									columnNumber: 17
								}, this), /* @__PURE__ */ _jsxDEV("span", {
									className: "font-medium",
									children: format(new Date(caseData.created_at), "MMM d, yyyy")
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 754,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 752,
								columnNumber: 15
							}, this), /* @__PURE__ */ _jsxDEV("div", {
								className: "flex justify-between",
								children: [/* @__PURE__ */ _jsxDEV("span", { children: "Last Updated" }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 759,
									columnNumber: 17
								}, this), /* @__PURE__ */ _jsxDEV("span", {
									className: "font-medium",
									children: format(new Date(caseData.updated_at), "MMM d, yyyy HH:mm")
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 760,
									columnNumber: 17
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 758,
								columnNumber: 15
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 751,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 747,
						columnNumber: 11
					}, this),
					isInvestigator && /* @__PURE__ */ _jsxDEV("div", {
						className: "rounded-xl p-3 flex items-start gap-2",
						style: {
							background: "rgba(6,15,30,0.04)",
							border: "1px solid rgba(6,15,30,0.1)"
						},
						children: [/* @__PURE__ */ _jsxDEV(Shield, {
							size: 13,
							className: "flex-shrink-0 mt-0.5",
							style: { color: "var(--color-navy-900)" }
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 771,
							columnNumber: 15
						}, this), /* @__PURE__ */ _jsxDEV("p", {
							className: "text-xs text-slate-500 leading-relaxed",
							children: "You cannot edit, delete, or alter original report content. All your actions are permanently logged."
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 772,
							columnNumber: 15
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 769,
						columnNumber: 13
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 543,
				columnNumber: 9
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 356,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 349,
		columnNumber: 5
	}, this);
}
_s(CaseDetailPage, "nfsqnRi72hjv/9TMnaJ9Yuose7I=", false, function() {
	return [
		useParams,
		useNavigate,
		useAuth
	];
});
_c = CaseDetailPage;
var _c;
$RefreshReg$(_c, "CaseDetailPage");
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
import * as __vite_react_currentExports from "/src/pages/CaseDetailPage.jsx";
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }

  const currentExports = __vite_react_currentExports;
  queueMicrotask(() => {
    RefreshRuntime.registerExportsForReactRefresh("C:/Users/Teyba/Desktop/DWBS system/client/src/pages/CaseDetailPage.jsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/Users/Teyba/Desktop/DWBS system/client/src/pages/CaseDetailPage.jsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
function $RefreshReg$(type, id) { return RefreshRuntime.register(type, "C:/Users/Teyba/Desktop/DWBS system/client/src/pages/CaseDetailPage.jsx" + ' ' + id); }
function $RefreshSig$() { return RefreshRuntime.createSignatureFunctionForTransform(); }

//# sourceMappingURL=data:application/json;base64,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QUFLLFNBQVMsVUFBVSxHQUFHLG1CQUFtQjtRQUN0RDs7OztnQkFDSDs7Ozs7ZUFDRjs7Ozs7Y0FDRjs7Ozs7O0tBR0osa0JBQ0Msd0JBQUMsT0FBRDtNQUFLLFdBQVU7TUFDYixPQUFPO09BQUUsWUFBWTtPQUFzQixRQUFRO01BQThCO2dCQURuRixDQUVFLHdCQUFDLFFBQUQ7T0FBUSxNQUFNO09BQUksV0FBVTtPQUF1QixPQUFPLEVBQUUsT0FBTyx3QkFBd0I7TUFBSTs7OztnQkFDL0Ysd0JBQUMsS0FBRDtPQUFHLFdBQVU7aUJBQXlDO01BRW5EOzs7O2NBQ0E7Ozs7OztJQUVKOzs7OztXQUNGOzs7OztVQUNGOzs7Ozs7QUFFVCIsIm5hbWVzIjpbXSwic291cmNlcyI6WyJDYXNlRGV0YWlsUGFnZS5qc3giXSwidmVyc2lvbiI6Mywic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdXNlU3RhdGUsIHVzZUVmZmVjdCB9IGZyb20gJ3JlYWN0JztcbmltcG9ydCB7IHVzZVBhcmFtcywgdXNlTmF2aWdhdGUgfSBmcm9tICdyZWFjdC1yb3V0ZXItZG9tJztcbmltcG9ydCBhcGkgZnJvbSAnLi4vc2VydmljZXMvYXBpJztcbmltcG9ydCB7IHVzZUF1dGggfSBmcm9tICcuLi9jb250ZXh0L0F1dGhDb250ZXh0JztcbmltcG9ydCB0b2FzdCBmcm9tICdyZWFjdC1ob3QtdG9hc3QnO1xuaW1wb3J0IHsgZm9ybWF0IH0gZnJvbSAnZGF0ZS1mbnMnO1xuaW1wb3J0IHtcbiAgQXJyb3dMZWZ0LCBGaWxlVGV4dCwgTG9jaywgU2VuZCwgVXNlcixcbiAgUGFwZXJjbGlwLCBEb3dubG9hZCwgRWRpdDMsIFNoaWVsZCwgQWxlcnRUcmlhbmdsZSwgSW5mbywgWmFwLCBVcGxvYWRcbn0gZnJvbSAnbHVjaWRlLXJlYWN0JztcblxuaW1wb3J0IHtcbiAgQ09NUExJQU5DRV9PRkZJQ0VSX1NUQVRVU0VTLFxuICBJTlZFU1RJR0FUT1JfU1RBVFVTRVMsXG4gIFNUQVRVU19CQURHRSxcbiAgZm9ybWF0U3RhdHVzLFxufSBmcm9tICcuLi9jb25zdGFudHMvY2FzZVdvcmtmbG93JztcblxuY29uc3QgUFJJT1JJVElFUyA9IFsnTG93JywgJ01lZGl1bScsICdIaWdoJywgJ0NyaXRpY2FsJ107XG5cbmNvbnN0IFBSSU9SSVRZX0NPTE9SID0ge1xuICBMb3c6ICAgICAgJ3RleHQtZ3JlZW4tNjAwJyxcbiAgTWVkaXVtOiAgICd0ZXh0LXllbGxvdy02MDAnLFxuICBIaWdoOiAgICAgJ3RleHQtb3JhbmdlLTYwMCcsXG4gIENyaXRpY2FsOiAndGV4dC1yZWQtNjAwJyxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIENhc2VEZXRhaWxQYWdlKCkge1xuICBjb25zdCB7IGlkIH0gICAgID0gdXNlUGFyYW1zKCk7XG4gIGNvbnN0IG5hdmlnYXRlICAgPSB1c2VOYXZpZ2F0ZSgpO1xuICBjb25zdCB7IHVzZXIgfSAgID0gdXNlQXV0aCgpO1xuXG4gIGNvbnN0IFtjYXNlRGF0YSwgICAgc2V0Q2FzZURhdGFdICAgID0gdXNlU3RhdGUobnVsbCk7XG4gIGNvbnN0IFtub3RlcywgICAgICAgc2V0Tm90ZXNdICAgICAgID0gdXNlU3RhdGUoW10pO1xuICBjb25zdCBbZXZpZGVuY2UsICAgIHNldEV2aWRlbmNlXSAgICA9IHVzZVN0YXRlKFtdKTtcbiAgY29uc3QgW2xvYWRpbmcsICAgICBzZXRMb2FkaW5nXSAgICAgPSB1c2VTdGF0ZSh0cnVlKTtcbiAgY29uc3QgW2Vycm9yLCAgICAgICBzZXRFcnJvcl0gICAgICAgPSB1c2VTdGF0ZShudWxsKTtcbiAgY29uc3QgW25vdGVCb2R5LCAgICBzZXROb3RlQm9keV0gICAgPSB1c2VTdGF0ZSgnJyk7XG4gIGNvbnN0IFtyZXBseVJlY2lwaWVudCwgc2V0UmVwbHlSZWNpcGllbnRdID0gdXNlU3RhdGUoJ0ludmVzdGlnYXRvcicpO1xuICBjb25zdCBbc2hvd0Z1bGxEZXNjcmlwdGlvbiwgc2V0U2hvd0Z1bGxEZXNjcmlwdGlvbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtpc0ludGVybmFsLCAgc2V0SXNJbnRlcm5hbF0gID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbc2VuZGluZ05vdGUsIHNldFNlbmRpbmdOb3RlXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3QgW2VkaXRNb2RlLCAgICBzZXRFZGl0TW9kZV0gICAgPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtuZXdTdGF0dXMsICAgc2V0TmV3U3RhdHVzXSAgID0gdXNlU3RhdGUoJycpO1xuICBjb25zdCBbbmV3UHJpb3JpdHksIHNldE5ld1ByaW9yaXR5XSA9IHVzZVN0YXRlKCcnKTtcbiAgY29uc3QgW3JlcXVlc3REZXNjcmlwdGlvbiwgc2V0UmVxdWVzdERlc2NyaXB0aW9uXSA9IHVzZVN0YXRlKCcnKTtcbiAgY29uc3QgW3JlcXVlc3RCcmFuY2gsIHNldFJlcXVlc3RCcmFuY2hdID0gdXNlU3RhdGUoJycpO1xuICBjb25zdCBbcmVxdWVzdFNldmVyaXR5LCBzZXRSZXF1ZXN0U2V2ZXJpdHldID0gdXNlU3RhdGUoJ01lZGl1bScpO1xuICBjb25zdCBbaW52ZXN0aWdhdG9ycywgc2V0SW52ZXN0aWdhdG9yc10gPSB1c2VTdGF0ZShbXSk7XG4gIGNvbnN0IFthc3NpZ25UbywgICAgc2V0QXNzaWduVG9dICAgID0gdXNlU3RhdGUoJycpO1xuICBjb25zdCBbdXBkYXRpbmcsICAgIHNldFVwZGF0aW5nXSAgICA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3QgW3VwbG9hZGluZ0V2aWRlbmNlLCBzZXRVcGxvYWRpbmdFdmlkZW5jZV0gPSB1c2VTdGF0ZShmYWxzZSk7XG5cbiAgLy8g4pSA4pSAIFBlci1zcGVjIHBlcm1pc3Npb24gZmxhZ3Mg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gIC8vIEpXVCBwYXlsb2FkIHVzZXMgYHVzZXJJZGAgKG5vdCBgaWRgKVxuICBjb25zdCBteVVzZXJJZCAgICAgICA9IHVzZXI/LnVzZXJJZCA/PyB1c2VyPy5pZDtcbiAgY29uc3QgaXNJbnZlc3RpZ2F0b3IgPSB1c2VyPy5yb2xlID09PSAnSW52ZXN0aWdhdG9yJztcbiAgY29uc3QgaXNTZW5pb3IgICAgICAgPSB1c2VyPy5yb2xlID09PSAnQ29tcGxpYW5jZV9PZmZpY2VyJztcbiAgY29uc3QgaXNDRU8gICAgICAgICAgPSB1c2VyPy5yb2xlID09PSAnQ0VPJztcbiAgY29uc3QgaXNPd25lciAgICAgICAgPSBCb29sZWFuKGNhc2VEYXRhICYmIGNhc2VEYXRhLm93bmVyX2lkID09PSBteVVzZXJJZCk7XG4gIGNvbnN0IGNhbk1hbmFnZU93blJlcXVlc3QgPSBbJ0VtcGxveWVlJywgJ0JyYW5jaF9NYW5hZ2VyJ10uaW5jbHVkZXModXNlcj8ucm9sZSkgJiYgaXNPd25lciAmJiBjYXNlRGF0YT8uc3VibWl0dGVkX2J5X3R5cGUgIT09ICdhbm9ueW1vdXMnO1xuICBjb25zdCBjYW5WaWV3RXZpZGVuY2UgPSBbJ0ludmVzdGlnYXRvcicsICdDb21wbGlhbmNlX09mZmljZXInXS5pbmNsdWRlcyh1c2VyPy5yb2xlKSB8fCBjYW5NYW5hZ2VPd25SZXF1ZXN0O1xuICAvLyBPbmx5IENvbXBsaWFuY2VfT2ZmaWNlciAvIFRlYW0gTGVhZCBjYW4gYXNzaWduL3JlYXNzaWduIGNhc2VzXG4gIGNvbnN0IGNhbkFzc2lnbiAgICAgID0gaXNTZW5pb3I7XG5cbiAgLy8gSW52ZXN0aWdhdG9ycyBjYW4gT05MWSBlZGl0IGNhc2VzIGV4cGxpY2l0bHkgYXNzaWduZWQgdG8gdGhlbSAoYXNzaWduZWRfdG8gPSB0aGVpciB1c2VySWQpXG4gIGNvbnN0IGlzQXNzaWduZWRUb01lID0gY2FzZURhdGEgPyAoY2FzZURhdGEuYXNzaWduZWRfdG8gPT09IG15VXNlcklkKSA6IGZhbHNlO1xuICBjb25zdCBjYW5FZGl0Tm93ICAgICA9IGlzU2VuaW9yIHx8IChpc0ludmVzdGlnYXRvciAmJiBpc0Fzc2lnbmVkVG9NZSkgfHwgY2FuTWFuYWdlT3duUmVxdWVzdDtcblxuICBjb25zdCBhbGxvd2VkU3RhdHVzT3B0aW9ucyA9IGNhc2VEYXRhXG4gICAgPyBbLi4ubmV3IFNldChbY2FzZURhdGEuc3RhdHVzLCAuLi4oaXNTZW5pb3IgPyBDT01QTElBTkNFX09GRklDRVJfU1RBVFVTRVMgOiBJTlZFU1RJR0FUT1JfU1RBVFVTRVMpXSldLmZpbHRlcihCb29sZWFuKVxuICAgIDogKGlzU2VuaW9yID8gQ09NUExJQU5DRV9PRkZJQ0VSX1NUQVRVU0VTIDogSU5WRVNUSUdBVE9SX1NUQVRVU0VTKTtcblxuICBjb25zdCBnZXROb3RlQXV0aG9yTGFiZWwgPSAobm90ZSkgPT4ge1xuICAgIGlmIChub3RlLmF1dGhvcl90eXBlID09PSAnQ29tcGxpYW5jZV9PZmZpY2VyJykgcmV0dXJuICdDb21wbGlhbmNlIFRlYW0gTGVhZCc7XG4gICAgaWYgKG5vdGUuYXV0aG9yX3R5cGUgPT09ICdJbnZlc3RpZ2F0b3InKSByZXR1cm4gJ0Nhc2UgSW52ZXN0aWdhdG9yJztcbiAgICBpZiAobm90ZS5hdXRob3JfdHlwZSA9PT0gJ1JlcG9ydGVyJykge1xuICAgICAgcmV0dXJuIGNhc2VEYXRhPy5zdWJtaXR0ZWRfYnlfdHlwZSA9PT0gJ2Fub255bW91cycgPyAnQW5vbnltb3VzIFJlcG9ydGVyJyA6ICdTdGFmZiBSZXBvcnRlcic7XG4gICAgfVxuICAgIHJldHVybiAnUmVwb3J0ZXInO1xuICB9O1xuXG4gIGNvbnN0IGdldE5vdGVDaGFubmVsTGFiZWwgPSAobm90ZSkgPT4ge1xuICAgIGlmIChub3RlLmF1ZGllbmNlX3R5cGUgPT09ICdDb21wbGlhbmNlX09mZmljZXInKSByZXR1cm4gJ0NvbXBsaWFuY2UgTGVhZCBUaHJlYWQnO1xuICAgIGlmIChub3RlLmF1ZGllbmNlX3R5cGUgPT09ICdJbnZlc3RpZ2F0b3InKSByZXR1cm4gJ0ludmVzdGlnYXRvciBUaHJlYWQnO1xuICAgIHJldHVybiAnR2VuZXJhbCBUaHJlYWQnO1xuICB9O1xuXG4gIGNvbnN0IGdldE5vdGVUb25lID0gKG5vdGUpID0+IHtcbiAgICBpZiAobm90ZS5pc19pbnRlcm5hbF9vbmx5KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBiYWNrZ3JvdW5kOiAncmdiYSgxMzksOTIsMjQ2LDAuMDYpJyxcbiAgICAgICAgYm9yZGVyQ29sb3I6ICdyZ2JhKDEzOSw5MiwyNDYsMC4yKScsXG4gICAgICAgIGxhYmVsQ29sb3I6ICcjN2MzYWVkJyxcbiAgICAgICAgaWNvbjogJ2ludGVybmFsJyxcbiAgICAgIH07XG4gICAgfVxuICAgIGlmIChub3RlLmF1dGhvcl90eXBlID09PSAnQ29tcGxpYW5jZV9PZmZpY2VyJykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYmFja2dyb3VuZDogJ3JnYmEoMzcsOTksMjM1LDAuMDYpJyxcbiAgICAgICAgYm9yZGVyQ29sb3I6ICdyZ2JhKDM3LDk5LDIzNSwwLjE4KScsXG4gICAgICAgIGxhYmVsQ29sb3I6ICcjMWQ0ZWQ4JyxcbiAgICAgICAgaWNvbjogJ3N0YWZmJyxcbiAgICAgIH07XG4gICAgfVxuICAgIGlmIChub3RlLmF1dGhvcl90eXBlID09PSAnSW52ZXN0aWdhdG9yJykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYmFja2dyb3VuZDogJ3JnYmEoMTAsMjksNTUsMC4wNSknLFxuICAgICAgICBib3JkZXJDb2xvcjogJ3JnYmEoMTAsMjksNTUsMC4xKScsXG4gICAgICAgIGxhYmVsQ29sb3I6ICd2YXIoLS1jb2xvci1uYXZ5LTkwMCknLFxuICAgICAgICBpY29uOiAnc3RhZmYnLFxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIGJhY2tncm91bmQ6ICdyZ2JhKDI0OSwxNjgsMzgsMC4wNyknLFxuICAgICAgYm9yZGVyQ29sb3I6ICdyZ2JhKDI0OSwxNjgsMzgsMC4yKScsXG4gICAgICBsYWJlbENvbG9yOiAndmFyKC0tY29sb3ItZ29sZC03MDApJyxcbiAgICAgIGljb246ICdyZXBvcnRlcicsXG4gICAgfTtcbiAgfTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGxvYWRDYXNlKCk7XG4gIH0sIFtpZF0pO1xuXG4gIGNvbnN0IGxvYWRDYXNlID0gYXN5bmMgKCkgPT4ge1xuICAgIHNldExvYWRpbmcodHJ1ZSk7XG4gICAgc2V0RXJyb3IobnVsbCk7XG4gICAgdHJ5IHtcbiAgICAgIC8vIENhc2UgZGV0YWlsICsgbm90ZXMgaW4gcGFyYWxsZWxcbiAgICAgIGNvbnN0IFtjUmVzLCBuUmVzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgYXBpLmdldChgL2Nhc2VzLyR7aWR9YCksXG4gICAgICAgIGFwaS5nZXQoYC9jYXNlcy8ke2lkfS9ub3Rlc2ApLFxuICAgICAgXSk7XG5cbiAgICAgIGNvbnN0IGMgPSBjUmVzLmRhdGEuY2FzZTtcbiAgICAgIHNldENhc2VEYXRhKGMpO1xuICAgICAgc2V0Tm90ZXMoblJlcy5kYXRhLm5vdGVzIHx8IFtdKTtcbiAgICAgIFxuICAgICAgLy8gVmFsaWRhdGUgc3RhdHVzIGlzIGluIGFsbG93ZWQgbGlzdCBmb3IgdGhpcyB1c2VyJ3Mgcm9sZVxuICAgICAgY29uc3QgYWxsb3dlZFN0YXR1c2VzID0gaXNTZW5pb3IgPyBDT01QTElBTkNFX09GRklDRVJfU1RBVFVTRVMgOiBJTlZFU1RJR0FUT1JfU1RBVFVTRVM7XG4gICAgICBzZXROZXdTdGF0dXMoYy5zdGF0dXMgfHwgYWxsb3dlZFN0YXR1c2VzWzBdKTtcbiAgICAgIFxuICAgICAgc2V0TmV3UHJpb3JpdHkoYy5wcmlvcml0eSB8fCAnTWVkaXVtJyk7XG4gICAgICBzZXRSZXF1ZXN0RGVzY3JpcHRpb24oYy5kZXNjcmlwdGlvbiB8fCAnJyk7XG4gICAgICBzZXRSZXF1ZXN0QnJhbmNoKGMuaW5jaWRlbnRfbG9jYXRpb24gfHwgJycpO1xuICAgICAgc2V0UmVxdWVzdFNldmVyaXR5KGMucHJpb3JpdHkgfHwgJ01lZGl1bScpO1xuICAgICAgc2V0QXNzaWduVG8oYy5hc3NpZ25lZF90bz8udG9TdHJpbmcoKSB8fCAnJyk7XG5cbiAgICAgIC8vIEV2aWRlbmNlIOKAlCBvbmx5IGZvciBwcml2aWxlZ2VkIHJvbGVzXG4gICAgICBpZiAoY2FuVmlld0V2aWRlbmNlKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgZVJlcyA9IGF3YWl0IGFwaS5nZXQoYC9jYXNlcy8ke2lkfS9ldmlkZW5jZWApO1xuICAgICAgICAgIHNldEV2aWRlbmNlKGVSZXMuZGF0YS5ldmlkZW5jZSB8fCBbXSk7XG4gICAgICAgIH0gY2F0Y2ggKF8pIHtcbiAgICAgICAgICBzZXRFdmlkZW5jZShbXSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gSW52ZXN0aWdhdG9yIGxpc3Qg4oCUIG9ubHkgZm9yIHRob3NlIHdobyBjYW4gYXNzaWduXG4gICAgICBpZiAoY2FuQXNzaWduKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgdVJlcyA9IGF3YWl0IGFwaS5nZXQoJy91c2VycycpO1xuICAgICAgICAgIGNvbnN0IGludiA9ICh1UmVzLmRhdGEudXNlcnMgfHwgW10pXG4gICAgICAgICAgICAuZmlsdGVyKHUgPT4gWydJbnZlc3RpZ2F0b3InLCAnQ29tcGxpYW5jZV9PZmZpY2VyJ10uaW5jbHVkZXModS5yb2xlKSlcbiAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiAoYS51c2VybmFtZSB8fCAnJykubG9jYWxlQ29tcGFyZShiLnVzZXJuYW1lIHx8ICcnKSk7XG4gICAgICAgICAgc2V0SW52ZXN0aWdhdG9ycyhpbnYpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byBsb2FkIGludmVzdGlnYXRvcnM6JywgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgIHNldEludmVzdGlnYXRvcnMoW10pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zdCBtc2cgPSBlcnIucmVzcG9uc2U/LmRhdGE/LmVycm9yIHx8ICdGYWlsZWQgdG8gbG9hZCBjYXNlJztcbiAgICAgIHNldEVycm9yKG1zZyk7XG4gICAgICB0b2FzdC5lcnJvcihtc2cpO1xuICAgIH1cbiAgICBzZXRMb2FkaW5nKGZhbHNlKTtcbiAgfTtcblxuICBjb25zdCBzZW5kTm90ZSA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoIW5vdGVCb2R5LnRyaW0oKSkgcmV0dXJuO1xuICAgIHNldFNlbmRpbmdOb3RlKHRydWUpO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBhcGkucG9zdChgL2Nhc2VzLyR7aWR9L25vdGVzYCwge1xuICAgICAgICBib2R5OiBub3RlQm9keSxcbiAgICAgICAgaXNfaW50ZXJuYWxfb25seTogaXNJbnRlcm5hbCxcbiAgICAgICAgcmVjaXBpZW50X3JvbGU6IGNhbk1hbmFnZU93blJlcXVlc3QgPyByZXBseVJlY2lwaWVudCA6IHVuZGVmaW5lZCxcbiAgICAgIH0pO1xuICAgICAgc2V0Tm90ZUJvZHkoJycpO1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgYXBpLmdldChgL2Nhc2VzLyR7aWR9L25vdGVzYCk7XG4gICAgICBzZXROb3RlcyhyZXMuZGF0YS5ub3RlcyB8fCBbXSk7XG4gICAgICB0b2FzdC5zdWNjZXNzKCdOb3RlIGFkZGVkJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0b2FzdC5lcnJvcihlcnIucmVzcG9uc2U/LmRhdGE/LmVycm9yIHx8ICdGYWlsZWQgdG8gc2VuZCBub3RlJyk7XG4gICAgfVxuICAgIHNldFNlbmRpbmdOb3RlKGZhbHNlKTtcbiAgfTtcblxuICBjb25zdCBkb3dubG9hZEV2aWRlbmNlID0gYXN5bmMgKGZpbGVJZCwgZmlsZW5hbWUpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBhcGkuZ2V0KGAvY2FzZXMvJHtpZH0vZXZpZGVuY2UvJHtmaWxlSWR9L2Rvd25sb2FkYCwge1xuICAgICAgICByZXNwb25zZVR5cGU6ICdibG9iJyxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgbWltZSA9IHJlc3BvbnNlLmhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddIHx8IHJlc3BvbnNlLmhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddIHx8ICcnO1xuICAgICAgY29uc3QgYmxvYiA9IG5ldyBCbG9iKFtyZXNwb25zZS5kYXRhXSwgeyB0eXBlOiBtaW1lIH0pO1xuXG4gICAgICAvLyBJZiB0aGUgc2VydmVyIHJldHVybmVkIEpTT04gKGVycm9yIHBheWxvYWQpIGFzIGEgYmxvYiwgcGFyc2UgYW5kIGRpc3BsYXkgdGhlIGVycm9yXG4gICAgICBpZiAobWltZS5pbmNsdWRlcygnYXBwbGljYXRpb24vanNvbicpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgdGV4dCA9IGF3YWl0IGJsb2IudGV4dCgpO1xuICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UodGV4dCk7XG4gICAgICAgICAgdG9hc3QuZXJyb3IocGFyc2VkLmVycm9yIHx8ICdEb3dubG9hZCBmYWlsZWQnKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gY2F0Y2ggKF8pIHtcbiAgICAgICAgICB0b2FzdC5lcnJvcignRG93bmxvYWQgZmFpbGVkJyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCB1cmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcblxuICAgICAgLy8gUHJldmlldyBpbmxpbmUgZm9yIGltYWdlcywgdmlkZW8sIGFuZCBQREZzOyBvdGhlcndpc2UgZm9yY2UgZG93bmxvYWRcbiAgICAgIGlmIChtaW1lLnN0YXJ0c1dpdGgoJ2ltYWdlLycpIHx8IG1pbWUuc3RhcnRzV2l0aCgndmlkZW8vJykgfHwgbWltZSA9PT0gJ2FwcGxpY2F0aW9uL3BkZicpIHtcbiAgICAgICAgLy8gT3BlbiBpbiBuZXcgdGFiIGZvciBwcmV2aWV3XG4gICAgICAgIHdpbmRvdy5vcGVuKHVybCwgJ19ibGFuaycpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgICAgbGluay5ocmVmID0gdXJsO1xuICAgICAgICBsaW5rLmRvd25sb2FkID0gZmlsZW5hbWU7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobGluayk7XG4gICAgICAgIGxpbmsuY2xpY2soKTtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChsaW5rKTtcbiAgICAgICAgd2luZG93LlVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRvYXN0LmVycm9yKGVyci5yZXNwb25zZT8uZGF0YT8uZXJyb3IgfHwgJ0Rvd25sb2FkIGZhaWxlZCcpO1xuICAgICAgY29uc29sZS5lcnJvcignRG93bmxvYWQgZXJyb3I6JywgZXJyKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgdXBkYXRlQ2FzZSA9IGFzeW5jICgpID0+IHtcbiAgICBzZXRVcGRhdGluZyh0cnVlKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgYm9keSA9IHt9O1xuICAgICAgaWYgKGNhbk1hbmFnZU93blJlcXVlc3QpIHtcbiAgICAgICAgYm9keS5kZXNjcmlwdGlvbiA9IHJlcXVlc3REZXNjcmlwdGlvbjtcbiAgICAgICAgYm9keS5icmFuY2hfb3JfZGVwdCA9IHJlcXVlc3RCcmFuY2g7XG4gICAgICAgIGJvZHkuc2V2ZXJpdHlfbGV2ZWwgPSByZXF1ZXN0U2V2ZXJpdHk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBib2R5LnN0YXR1cyA9IG5ld1N0YXR1cztcbiAgICAgICAgYm9keS5wcmlvcml0eSA9IG5ld1ByaW9yaXR5O1xuICAgICAgICBpZiAoYXNzaWduVG8pIGJvZHkuYXNzaWduZWRfdG8gPSBwYXJzZUludChhc3NpZ25UbywgMTApO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBhcGkucGF0Y2goYC9jYXNlcy8ke2lkfWAsIGJvZHkpO1xuICAgICAgYXdhaXQgbG9hZENhc2UoKTtcbiAgICAgIHNldEVkaXRNb2RlKGZhbHNlKTtcbiAgICAgIHRvYXN0LnN1Y2Nlc3MoJ0Nhc2UgdXBkYXRlZCBzdWNjZXNzZnVsbHknKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnN0IG1zZyA9IGVyci5yZXNwb25zZT8uZGF0YT8uZXJyb3IgfHwgZXJyLm1lc3NhZ2UgfHwgJ1VwZGF0ZSBmYWlsZWQnO1xuICAgICAgdG9hc3QuZXJyb3IobXNnKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1VwZGF0ZSBmYWlsZWQ6JywgZXJyKTtcbiAgICB9XG4gICAgc2V0VXBkYXRpbmcoZmFsc2UpO1xuICA7fVxuXG4gIGNvbnN0IHVwbG9hZEV2aWRlbmNlID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgY29uc3QgZmlsZSA9IGV2ZW50LnRhcmdldC5maWxlcz8uWzBdO1xuICAgIGlmICghZmlsZSkgcmV0dXJuO1xuXG4gICAgc2V0VXBsb2FkaW5nRXZpZGVuY2UodHJ1ZSk7XG4gICAgY29uc3QgZm9ybURhdGEgPSBuZXcgRm9ybURhdGEoKTtcbiAgICBmb3JtRGF0YS5hcHBlbmQoJ2ZpbGUnLCBmaWxlKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBhcGkucG9zdChgL2Nhc2VzLyR7aWR9L2V2aWRlbmNlYCwgZm9ybURhdGEsIHtcbiAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ211bHRpcGFydC9mb3JtLWRhdGEnIH0sXG4gICAgICB9KTtcbiAgICAgIGF3YWl0IGxvYWRDYXNlKCk7XG4gICAgICB0b2FzdC5zdWNjZXNzKCdBZGRpdGlvbmFsIGV2aWRlbmNlIHVwbG9hZGVkJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0b2FzdC5lcnJvcihlcnIucmVzcG9uc2U/LmRhdGE/LmVycm9yIHx8ICdFdmlkZW5jZSB1cGxvYWQgZmFpbGVkJyk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldFVwbG9hZGluZ0V2aWRlbmNlKGZhbHNlKTtcbiAgICAgIGV2ZW50LnRhcmdldC52YWx1ZSA9ICcnO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBkZWxldGVDYXNlUmVxdWVzdCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBqdXN0aWZpY2F0aW9uID0gd2luZG93LnByb21wdCgnUGxlYXNlIHByb3ZpZGUgYSBqdXN0aWZpY2F0aW9uIGZvciBkZWxldGluZyB0aGlzIHJlcXVlc3QgKDEwKyBjaGFyYWN0ZXJzKTonKTtcbiAgICBpZiAoIWp1c3RpZmljYXRpb24gfHwganVzdGlmaWNhdGlvbi50cmltKCkubGVuZ3RoIDwgMTApIHtcbiAgICAgIHRvYXN0LmVycm9yKCdBIGp1c3RpZmljYXRpb24gb2YgYXQgbGVhc3QgMTAgY2hhcmFjdGVycyBpcyByZXF1aXJlZC4nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgYXBpLmRlbGV0ZShgL2Nhc2VzLyR7aWR9YCwgeyBkYXRhOiB7IGp1c3RpZmljYXRpb24sIHJlcXVpcmVzX2FwcHJvdmFsOiBmYWxzZSB9IH0pO1xuICAgICAgdG9hc3Quc3VjY2VzcygnUmVxdWVzdCBkZWxldGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgbmF2aWdhdGUoJy9kYXNoYm9hcmQnKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRvYXN0LmVycm9yKGVyci5yZXNwb25zZT8uZGF0YT8uZXJyb3IgfHwgJ0RlbGV0ZSBmYWlsZWQnKTtcbiAgICB9XG4gIH07XG5cbiAgLy8g4pSA4pSAIExvYWRpbmcgLyBFcnJvciBzdGF0ZXMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gIGlmICh1c2VyPy5yb2xlID09PSAnU3lzdGVtX0FkbWluJykge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cInAtNiBtYXgtdy0yeGwgbXgtYXV0byB0ZXh0LWNlbnRlciBweS0yMCBmYWRlLWluLXVwXCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY2FyZCBwLTggYm9yZGVyIGJvcmRlci1yZWQtMTAwIHNoYWRvdy1zbVwiPlxuICAgICAgICAgIDxMb2NrIHNpemU9ezQ4fSBjbGFzc05hbWU9XCJteC1hdXRvIG1iLTQgdGV4dC1yZWQtNTAwXCIgLz5cbiAgICAgICAgICA8aDIgY2xhc3NOYW1lPVwidGV4dC14bCBmb250LWJvbGQgdGV4dC1zbGF0ZS04MDAgbWItMlwiPkV0aGljYWwgV2FsbCAtIEFjY2VzcyBEZW5pZWQ8L2gyPlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc2xhdGUtNTAwIHRleHQtc20gbWItNlwiPlxuICAgICAgICAgICAgU3lzdGVtIEFkbWluaXN0cmF0b3JzIGFyZSBzdHJpY3RseSBwcm9oaWJpdGVkIGZyb20gdmlld2luZyBjYXNlIGNvbnRlbnRzLCBub3Rlcywgb3IgZXZpZGVuY2UuXG4gICAgICAgICAgPC9wPlxuICAgICAgICAgIDxidXR0b24gb25DbGljaz17KCkgPT4gbmF2aWdhdGUoLTEpfSBjbGFzc05hbWU9XCJidG4gYnRuLXByaW1hcnlcIj5HbyBCYWNrPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxuXG4gIGlmIChsb2FkaW5nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgaC05NlwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwic3Bpbm5lciBzcGlubmVyLW5hdnlcIiAvPlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1zbGF0ZS00MDAgbXQtM1wiPkxvYWRpbmcgY2FzZSBkZXRhaWxzLi4uPC9wPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cblxuICBpZiAoZXJyb3IgfHwgIWNhc2VEYXRhKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC02IG1heC13LTJ4bCBteC1hdXRvXCI+XG4gICAgICAgIDxidXR0b24gb25DbGljaz17KCkgPT4gbmF2aWdhdGUoLTEpfSBjbGFzc05hbWU9XCJidG4gYnRuLWdob3N0IG1iLTZcIj5cbiAgICAgICAgICA8QXJyb3dMZWZ0IHNpemU9ezE2fSAvPiBCYWNrXG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNhcmQgcC04IHRleHQtY2VudGVyXCI+XG4gICAgICAgICAgPEFsZXJ0VHJpYW5nbGUgc2l6ZT17NDB9IGNsYXNzTmFtZT1cIm14LWF1dG8gbWItMyB0ZXh0LXJlZC00MDBcIiAvPlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCB0ZXh0LXNsYXRlLTcwMCBtYi0xXCI+RmFpbGVkIHRvIExvYWQgQ2FzZTwvcD5cbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtc2xhdGUtNDAwIG1iLTRcIj57ZXJyb3IgfHwgJ0Nhc2Ugbm90IGZvdW5kIG9yIGFjY2VzcyBkZW5pZWQuJ308L3A+XG4gICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXtsb2FkQ2FzZX0gY2xhc3NOYW1lPVwiYnRuIGJ0bi1wcmltYXJ5XCI+VHJ5IEFnYWluPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJwLTYgbWF4LXctNXhsIG14LWF1dG8gZmFkZS1pbi11cFwiPlxuXG4gICAgICB7LyogQmFjayAqL31cbiAgICAgIDxidXR0b24gb25DbGljaz17KCkgPT4gbmF2aWdhdGUoLTEpfSBjbGFzc05hbWU9XCJidG4gYnRuLWdob3N0IG1iLTYgLW1sLTJcIj5cbiAgICAgICAgPEFycm93TGVmdCBzaXplPXsxNn0gLz4gQmFjayB0byBDYXNlc1xuICAgICAgPC9idXR0b24+XG5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBsZzpncmlkLWNvbHMtMyBnYXAtNlwiPlxuXG4gICAgICAgIHsvKiDilIDilIAgTWFpbiBjb2x1bW4g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAICovfVxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImxnOmNvbC1zcGFuLTIgc3BhY2UteS02XCI+XG5cbiAgICAgICAgICB7LyogQ2FzZSBIZWFkZXIgKi99XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjYXJkIHAtNlwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLXN0YXJ0IGp1c3RpZnktYmV0d2VlbiBnYXAtNCBtYi00XCI+XG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNsYXRlLTQwMCBmb250LXNlbWlib2xkIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciBtYi0xXCI+XG4gICAgICAgICAgICAgICAgICBSZWZlcmVuY2UgQ29kZVxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICA8aDEgY2xhc3NOYW1lPVwidGV4dC0yeGwgZm9udC1tb25vIGZvbnQtYm9sZCB0cmFja2luZy13aWRlc3RcIlxuICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgY29sb3I6ICd2YXIoLS1jb2xvci1uYXZ5LTkwMCknIH19PlxuICAgICAgICAgICAgICAgICAge2Nhc2VEYXRhLnJlZmVyZW5jZV9pZH1cbiAgICAgICAgICAgICAgICA8L2gxPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPXtgYmFkZ2UgJHtTVEFUVVNfQkFER0VbY2FzZURhdGEuc3RhdHVzXSB8fCAnYmFkZ2UtcmV2aWV3J30gdGV4dC1zbWB9PlxuICAgICAgICAgICAgICAgIHtmb3JtYXRTdGF0dXMoY2FzZURhdGEuc3RhdHVzKX1cbiAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMiBnYXAtMyBtYi01XCI+XG4gICAgICAgICAgICAgIHtbXG4gICAgICAgICAgICAgICAgWydDYXRlZ29yeScsICAgICAgY2FzZURhdGEuY2F0ZWdvcnk/LnJlcGxhY2UoL18vZywgJyAnKV0sXG4gICAgICAgICAgICAgICAgWydQcmlvcml0eScsICAgICAgY2FzZURhdGEucHJpb3JpdHldLFxuICAgICAgICAgICAgICAgIFsnU3VibWl0dGVkIEJ5JywgIGNhc2VEYXRhLnN1Ym1pdHRlZF9ieV90eXBlID09PSAnYW5vbnltb3VzJyA/ICfwn5SSIEFub255bW91cycgOiAn8J+RpCBTdGFmZiddLFxuICAgICAgICAgICAgICAgIFsnRGF0ZSBTdWJtaXR0ZWQnLGZvcm1hdChuZXcgRGF0ZShjYXNlRGF0YS5jcmVhdGVkX2F0KSwgJ01NTSBkLCB5eXl5IEhIOm1tJyldLFxuICAgICAgICAgICAgICAgIGNhc2VEYXRhLmluY2lkZW50X2xvY2F0aW9uICYmIFsnTG9jYXRpb24nLCBjYXNlRGF0YS5pbmNpZGVudF9sb2NhdGlvbl0sXG4gICAgICAgICAgICAgICAgWydMYXN0IFVwZGF0ZWQnLCAgZm9ybWF0KG5ldyBEYXRlKGNhc2VEYXRhLnVwZGF0ZWRfYXQpLCAnTU1NIGQsIHl5eXkgSEg6bW0nKV0sXG4gICAgICAgICAgICAgIF0uZmlsdGVyKEJvb2xlYW4pLm1hcCgoW2xhYmVsLCB2YWx1ZV0pID0+IChcbiAgICAgICAgICAgICAgICA8ZGl2IGtleT17bGFiZWx9IGNsYXNzTmFtZT1cInAtMyByb3VuZGVkLWxnXCIgc3R5bGU9e3sgYmFja2dyb3VuZDogJ3ZhcigtLWNvbG9yLXNsYXRlLTUwKScgfX0+XG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtc2xhdGUtNDAwIG1iLTAuNVwiPntsYWJlbH08L3A+XG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9e2B0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgJHtsYWJlbCA9PT0gJ1ByaW9yaXR5JyA/IFBSSU9SSVRZX0NPTE9SW3ZhbHVlXSA6ICd0ZXh0LXNsYXRlLTcwMCd9YH0+XG4gICAgICAgICAgICAgICAgICAgIHt2YWx1ZX1cbiAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgey8qIERlc2NyaXB0aW9uIOKAlCBub3Qgc2hvd24gdG8gQnJhbmNoIE1hbmFnZXIgKGxvdy1wcml2KSAqL31cbiAgICAgICAgICAgIHtjYXNlRGF0YS5kZXNjcmlwdGlvbiAmJiAoXG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNsYXRlLTQwMCBmb250LXNlbWlib2xkIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciBtYi0yXCI+XG4gICAgICAgICAgICAgICAgICBSZXBvcnQgRGVzY3JpcHRpb25cbiAgICAgICAgICAgICAgICA8L3A+XG5cbiAgICAgICAgICAgICAgICB7LyogUmVzcG9uc2l2ZSBkZXNjcmlwdGlvbjogd3JhcCBsb25nIHdvcmRzLCBhbGxvdyBwcmUtZm9ybWF0dGVkIG5ld2xpbmVzLCBhbmQgbGltaXQgaGVpZ2h0IG9uIHNtYWxsIHNjcmVlbnMgKi99XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1zbGF0ZS01MCByb3VuZGVkLXhsIHAtNFwiPlxuICAgICAgICAgICAgICAgICAgPHBcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgdGV4dC1zbSB0ZXh0LXNsYXRlLTcwMCBsZWFkaW5nLXJlbGF4ZWQgd2hpdGVzcGFjZS1wcmUtd3JhcCBicmVhay13b3JkcyAke1xuICAgICAgICAgICAgICAgICAgICAgIHNob3dGdWxsRGVzY3JpcHRpb24gPyAnbWF4LWgtW25vbmVdJyA6ICdtYXgtaC00MCdcbiAgICAgICAgICAgICAgICAgICAgfSBvdmVyZmxvdy1hdXRvYH1cbiAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgd29yZEJyZWFrOiAnYnJlYWstd29yZCcgfX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge2Nhc2VEYXRhLmRlc2NyaXB0aW9ufVxuICAgICAgICAgICAgICAgICAgPC9wPlxuXG4gICAgICAgICAgICAgICAgICB7LyogU2hvdyBtb3JlL2xlc3MgdG9nZ2xlIGZvciBsb25nIGRlc2NyaXB0aW9ucyAqL31cbiAgICAgICAgICAgICAgICAgIHtTdHJpbmcoY2FzZURhdGEuZGVzY3JpcHRpb24pLmxlbmd0aCA+IDMwMCAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXQtMiB0ZXh0LXJpZ2h0XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2hvd0Z1bGxEZXNjcmlwdGlvbihzID0+ICFzKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQteHMgZm9udC1zZW1pYm9sZCB0ZXh0LW5hdnktOTAwIHVuZGVybGluZVwiXG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAge3Nob3dGdWxsRGVzY3JpcHRpb24gPyAnU2hvdyBsZXNzJyA6ICdTaG93IG1vcmUnfVxuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAgey8qIEludmVzdGlnYXRvciByZXN0cmljdGlvbiBub3RpY2UgKi99XG4gICAgICAgICAgICB7aXNJbnZlc3RpZ2F0b3IgJiYgIWlzQXNzaWduZWRUb01lICYmIChcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC00IHAtMyByb3VuZGVkLWxnIGZsZXggaXRlbXMtc3RhcnQgZ2FwLTIgYmctYW1iZXItNTAgYm9yZGVyIGJvcmRlci1hbWJlci0yMDBcIj5cbiAgICAgICAgICAgICAgICA8SW5mbyBzaXplPXsxNH0gY2xhc3NOYW1lPVwidGV4dC1hbWJlci02MDAgZmxleC1zaHJpbmstMCBtdC0wLjVcIiAvPlxuICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1hbWJlci04MDBcIj5cbiAgICAgICAgICAgICAgICAgIHtjYXNlRGF0YS5hc3NpZ25lZF90byA9PT0gbnVsbFxuICAgICAgICAgICAgICAgICAgICA/ICdUaGlzIGNhc2UgaXMgdW5hc3NpZ25lZC4gQSBDb21wbGlhbmNlIE9mZmljZXIgbXVzdCBhc3NpZ24gaXQgdG8geW91IGJlZm9yZSB5b3UgY2FuIG1ha2UgY2hhbmdlcy4nXG4gICAgICAgICAgICAgICAgICAgIDogJ1RoaXMgY2FzZSBiZWxvbmdzIHRvIGFub3RoZXIgaW52ZXN0aWdhdG9yLiBZb3UgY2FuIHZpZXcgaXQgYnV0IGNhbm5vdCBtYWtlIGNoYW5nZXMuJ31cbiAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgIHsvKiBDb3JyZXNwb25kZW5jZSAqL31cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNhcmQgcC02XCI+XG4gICAgICAgICAgICA8aDIgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LWJvbGQgbWItNFwiIHN0eWxlPXt7IGNvbG9yOiAndmFyKC0tY29sb3ItbmF2eS05MDApJyB9fT5cbiAgICAgICAgICAgICAgQ29ycmVzcG9uZGVuY2UgJiBOb3Rlc1xuICAgICAgICAgICAgPC9oMj5cblxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTMgbWItNiBtYXgtaC05NiBvdmVyZmxvdy15LWF1dG8gcHItMVwiPlxuICAgICAgICAgICAgICB7bm90ZXMubGVuZ3RoID09PSAwID8gKFxuICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1zbGF0ZS00MDAgdGV4dC1jZW50ZXIgcHktNlwiPk5vIG5vdGVzIHlldC48L3A+XG4gICAgICAgICAgICAgICkgOiBub3Rlcy5tYXAoKG4sIGkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB0b25lID0gZ2V0Tm90ZVRvbmUobik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICA8ZGl2IGtleT17bi5pZCB8fCBpfVxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgcC00IHJvdW5kZWQteGwgJHtuLmF1dGhvcl90eXBlID09PSAnUmVwb3J0ZXInID8gJ21sLTYnIDogJyd9YH1cbiAgICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHRvbmUuYmFja2dyb3VuZCxcbiAgICAgICAgICAgICAgICAgICAgYm9yZGVyOiAnMXB4IHNvbGlkJyxcbiAgICAgICAgICAgICAgICAgICAgYm9yZGVyQ29sb3I6IHRvbmUuYm9yZGVyQ29sb3IsXG4gICAgICAgICAgICAgICAgICB9fT5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIG1iLTIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgIHt0b25lLmljb24gPT09ICdzdGFmZidcbiAgICAgICAgICAgICAgICAgICAgICAgID8gPFVzZXIgc2l6ZT17MTJ9IGNsYXNzTmFtZT1cInRleHQtc2xhdGUtNDAwXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDogPFNoaWVsZCBzaXplPXsxMn0gc3R5bGU9e3sgY29sb3I6ICd2YXIoLS1jb2xvci1nb2xkLTUwMCknIH19IC8+fVxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQteHMgZm9udC1zZW1pYm9sZFwiIHN0eWxlPXt7IGNvbG9yOiB0b25lLmxhYmVsQ29sb3IgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICB7Z2V0Tm90ZUF1dGhvckxhYmVsKG4pfVxuICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICB7bi5hdWRpZW5jZV90eXBlICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQteHMgcHgtMS41IHB5LTAuNSByb3VuZGVkIGZvbnQtbWVkaXVtIGJnLXNsYXRlLTEwMCB0ZXh0LXNsYXRlLTUwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7Z2V0Tm90ZUNoYW5uZWxMYWJlbChuKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgIHtuLmlzX2ludGVybmFsX29ubHkgPT09IDEgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14cyBweC0xLjUgcHktMC41IHJvdW5kZWQgZm9udC1tZWRpdW1cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17eyBiYWNrZ3JvdW5kOiAncmdiYSgxMzksOTIsMjQ2LDAuMTIpJywgY29sb3I6ICcjN2MzYWVkJyB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPExvY2sgc2l6ZT17OX0gY2xhc3NOYW1lPVwiaW5saW5lIG1yLTAuNVwiIC8+SW50ZXJuYWwgT25seVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtc2xhdGUtNDAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAge2Zvcm1hdChuZXcgRGF0ZShuLmNyZWF0ZWRfYXQpLCAnTU1NIGQsIEhIOm1tJyl9XG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LXNsYXRlLTcwMCBsZWFkaW5nLXJlbGF4ZWRcIj57bi5ib2R5fTwvcD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9KX1cbiAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICB7LyogQWRkIG5vdGUg4oCUIG9ubHkgZm9yIGVkaXRvcnMgb3Igb3duIHJlcXVlc3Qgb3duZXJzICovfVxuICAgICAgICAgICAge2NhbkVkaXROb3cgJiYgKFxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJvcmRlci10IGJvcmRlci1zbGF0ZS0xMDAgcHQtNFwiPlxuICAgICAgICAgICAgICAgIDx0ZXh0YXJlYVxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZm9ybS10ZXh0YXJlYSBtYi0zXCJcbiAgICAgICAgICAgICAgICAgIHJvd3M9ezN9XG4gICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj17aXNJbnZlc3RpZ2F0b3JcbiAgICAgICAgICAgICAgICAgICAgPyAnQWRkIGFuIGludGVybmFsIG5vdGUgb3Igc2VuZCBhIG1lc3NhZ2UgdG8gdGhlIHJlcG9ydGVyLi4uJ1xuICAgICAgICAgICAgICAgICAgICA6ICdBZGQgYSBub3RlLi4uJ31cbiAgICAgICAgICAgICAgICAgIHZhbHVlPXtub3RlQm9keX1cbiAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IHNldE5vdGVCb2R5KGUudGFyZ2V0LnZhbHVlKX1cbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIHtjYW5NYW5hZ2VPd25SZXF1ZXN0ICYmIChcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWItM1wiPlxuICAgICAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwiZm9ybS1sYWJlbCB0ZXh0LXhzXCI+UmVwbHkgVG88L2xhYmVsPlxuICAgICAgICAgICAgICAgICAgICA8c2VsZWN0XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZm9ybS1zZWxlY3QgdGV4dC1zbVwiXG4gICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e3JlcGx5UmVjaXBpZW50fVxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IHNldFJlcGx5UmVjaXBpZW50KGUudGFyZ2V0LnZhbHVlKX1cbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJJbnZlc3RpZ2F0b3JcIj5DYXNlIEludmVzdGlnYXRvcjwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJDb21wbGlhbmNlX09mZmljZXJcIj5Db21wbGlhbmNlIFRlYW0gTGVhZDwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAgICA8L3NlbGVjdD5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTNcIj5cbiAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBjdXJzb3ItcG9pbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiY2hlY2tib3hcIlxuICAgICAgICAgICAgICAgICAgICAgIGNoZWNrZWQ9e2lzSW50ZXJuYWx9XG4gICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9e2UgPT4gc2V0SXNJbnRlcm5hbChlLnRhcmdldC5jaGVja2VkKX1cbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LTQgaC00IHJvdW5kZWRcIlxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtc2xhdGUtNTAwIGZsZXggaXRlbXMtY2VudGVyIGdhcC0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPExvY2sgc2l6ZT17MTF9IC8+IEludGVybmFsIG5vdGUgb25seSAoaGlkZGVuIGZyb20gcmVwb3J0ZXIpXG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3NlbmROb3RlfVxuICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17c2VuZGluZ05vdGUgfHwgIW5vdGVCb2R5LnRyaW0oKX1cbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYnRuIGJ0bi1wcmltYXJ5IHRleHQtc21cIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICB7c2VuZGluZ05vdGUgPyA8c3BhbiBjbGFzc05hbWU9XCJzcGlubmVyXCIgLz4gOiA8U2VuZCBzaXplPXsxNH0gLz59XG4gICAgICAgICAgICAgICAgICAgIFNlbmRcbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHsvKiDilIDilIAgU2lkZWJhciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAgKi99XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS01XCI+XG5cbiAgICAgICAgICB7LyogQ2FzZSBBY3Rpb25zICovfVxuICAgICAgICAgIHtjYW5FZGl0Tm93ICYmIChcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY2FyZCBwLTVcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gbWItNFwiPlxuICAgICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LXNtIGZvbnQtYm9sZFwiIHN0eWxlPXt7IGNvbG9yOiAndmFyKC0tY29sb3ItbmF2eS05MDApJyB9fT5cbiAgICAgICAgICAgICAgICAgIENhc2UgQWN0aW9uc1xuICAgICAgICAgICAgICAgIDwvaDM+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0RWRpdE1vZGUoZSA9PiAhZSl9XG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJidG4gYnRuLWdob3N0IHRleHQteHMgcHktMSBweC0yXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8RWRpdDMgc2l6ZT17MTJ9IC8+IHtlZGl0TW9kZSA/ICdDYW5jZWwnIDogJ0VkaXQnfVxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICB7ZWRpdE1vZGUgPyAoXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTNcIj5cbiAgICAgICAgICAgICAgICAgIHtjYW5NYW5hZ2VPd25SZXF1ZXN0ID8gKFxuICAgICAgICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwiZm9ybS1sYWJlbCB0ZXh0LXhzXCI+RGVzY3JpcHRpb248L2xhYmVsPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHRleHRhcmVhXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZvcm0tdGV4dGFyZWEgdGV4dC1zbVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJvd3M9ezR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtyZXF1ZXN0RGVzY3JpcHRpb259XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IHNldFJlcXVlc3REZXNjcmlwdGlvbihlLnRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwiZm9ybS1sYWJlbCB0ZXh0LXhzXCI+QnJhbmNoIC8gRGVwYXJ0bWVudDwvbGFiZWw+XG4gICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cInRleHRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmb3JtLWlucHV0IHRleHQtc21cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17cmVxdWVzdEJyYW5jaH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9e2UgPT4gc2V0UmVxdWVzdEJyYW5jaChlLnRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJmb3JtLWxhYmVsIHRleHQteHNcIj5TdGF0dXM8L2xhYmVsPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNlbGVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmb3JtLXNlbGVjdCB0ZXh0LXNtXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e25ld1N0YXR1c31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9e2UgPT4gc2V0TmV3U3RhdHVzKGUudGFyZ2V0LnZhbHVlKX1cbiAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAge2FsbG93ZWRTdGF0dXNPcHRpb25zLm1hcChzID0+IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8b3B0aW9uIGtleT17c30gdmFsdWU9e3N9Pntmb3JtYXRTdGF0dXMocyl9PC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9zZWxlY3Q+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIG1iLTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImZvcm0tbGFiZWwgdGV4dC14c1wiPlNldmVyaXR5IC8gUHJpb3JpdHk8L2xhYmVsPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtc2xhdGUtNDAwXCI+KENvbXBsaWFuY2UgT2ZmaWNlciBvbmx5KTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAge2lzU2VuaW9yID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzZWxlY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZvcm0tc2VsZWN0IHRleHQtc21cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e25ld1ByaW9yaXR5fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9e2UgPT4gc2V0TmV3UHJpb3JpdHkoZS50YXJnZXQudmFsdWUpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtQUklPUklUSUVTLm1hcChwID0+IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiBrZXk9e3B9IHZhbHVlPXtwfT57cH08L29wdGlvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc2VsZWN0PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtuZXdQcmlvcml0eSA9PT0gJ0NyaXRpY2FsJyAmJiAhY2FzZURhdGEuaXNfZXNjYWxhdGVkICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1hbWJlci02MDAgbXQtMSBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8WmFwIHNpemU9ezEyfSAvPiBTZXR0aW5nIHRvIENyaXRpY2FsIHdpbGwgZXNjYWxhdGUgdG8gQ0VPXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1zZW1pYm9sZFwiPntjYXNlRGF0YS5wcmlvcml0eX08L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAge2NhbkFzc2lnbiAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwiZm9ybS1sYWJlbCB0ZXh0LXhzXCI+QXNzaWduIFRvPC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNlbGVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZvcm0tc2VsZWN0IHRleHQtc21cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXthc3NpZ25Ub31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17ZSA9PiBzZXRBc3NpZ25UbyhlLnRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiXCI+e2Nhc2VEYXRhLmFzc2lnbmVkX2ludmVzdGlnYXRvciA/ICdSZWFzc2lnbi4uLicgOiAnQXNzaWduIGludmVzdGlnYXRvcid9PC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2ludmVzdGlnYXRvcnMubGVuZ3RoID4gMCA/IGludmVzdGlnYXRvcnMubWFwKHUgPT4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiBrZXk9e3UuaWR9IHZhbHVlPXt1LmlkfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge3UudXNlcm5hbWV9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L29wdGlvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApKSA6IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxvcHRpb24gZGlzYWJsZWQ+Tm8gaW52ZXN0aWdhdG9yczwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvc2VsZWN0PlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICAgICApfVxuXG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3VwZGF0ZUNhc2V9XG4gICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXt1cGRhdGluZ31cbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYnRuIGJ0bi1nb2xkIHctZnVsbCB0ZXh0LXNtXCJcbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge3VwZGF0aW5nID8gPHNwYW4gY2xhc3NOYW1lPVwic3Bpbm5lciBzcGlubmVyLW5hdnlcIiAvPiA6IG51bGx9XG4gICAgICAgICAgICAgICAgICAgIFNhdmUgQ2hhbmdlc1xuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTIgdGV4dC1zbVwiPlxuICAgICAgICAgICAgICAgICAge2Nhc2VEYXRhLmlzX2VzY2FsYXRlZCAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgcC0yIGJnLXJlZC01MCBib3JkZXIgYm9yZGVyLXJlZC0yMDAgcm91bmRlZC1tZCBtYi0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPFphcCBzaXplPXsxNH0gY2xhc3NOYW1lPVwidGV4dC1yZWQtNjAwXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIGZvbnQtc2VtaWJvbGQgdGV4dC1yZWQtNzAwXCI+RXNjYWxhdGVkIHRvIENFTzwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS01MDBcIj5TdGF0dXM8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT17YGJhZGdlICR7U1RBVFVTX0JBREdFW2Nhc2VEYXRhLnN0YXR1c10gfHwgJ2JhZGdlLXJldmlldyd9YH0+XG4gICAgICAgICAgICAgICAgICAgICAge2Zvcm1hdFN0YXR1cyhjYXNlRGF0YS5zdGF0dXMpfVxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWJldHdlZW4gaXRlbXMtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc2xhdGUtNTAwXCI+UHJpb3JpdHk8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT17YGZvbnQtc2VtaWJvbGQgdGV4dC1zbSAke1BSSU9SSVRZX0NPTE9SW2Nhc2VEYXRhLnByaW9yaXR5XX1gfT5cbiAgICAgICAgICAgICAgICAgICAgICB7Y2FzZURhdGEucHJpb3JpdHl9XG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1jZW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS01MDBcIj5Bc3NpZ25lZCBUbzwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1zZW1pYm9sZCB0ZXh0LXNsYXRlLTcwMCB0ZXh0LXhzIHRleHQtcmlnaHRcIj5cbiAgICAgICAgICAgICAgICAgICAgICB7Y2FzZURhdGEuYXNzaWduZWRfaW52ZXN0aWdhdG9yIHx8ICdVbmFzc2lnbmVkJ31cbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApfVxuXG4gICAgICAgICAge2Nhbk1hbmFnZU93blJlcXVlc3QgJiYgKFxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjYXJkIHAtNVwiPlxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LWJvbGQgbWItM1wiIHN0eWxlPXt7IGNvbG9yOiAndmFyKC0tY29sb3ItbmF2eS05MDApJyB9fT5cbiAgICAgICAgICAgICAgICBNYW5hZ2UgUmVxdWVzdFxuICAgICAgICAgICAgICA8L2gzPlxuICAgICAgICAgICAgICA8YnV0dG9uIG9uQ2xpY2s9e2RlbGV0ZUNhc2VSZXF1ZXN0fSBjbGFzc05hbWU9XCJidG4gYnRuLWdob3N0IHctZnVsbCB0ZXh0LXNtIG1iLTNcIj5cbiAgICAgICAgICAgICAgICBEZWxldGUgUmVxdWVzdFxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG5cbiAgICAgICAgICB7LyogRXZpZGVuY2UgKi99XG4gICAgICAgICAge2NhblZpZXdFdmlkZW5jZSAmJiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNhcmQgcC01XCI+XG4gICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LXNtIGZvbnQtYm9sZCBtYi0zIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCJcbiAgICAgICAgICAgICAgICBzdHlsZT17eyBjb2xvcjogJ3ZhcigtLWNvbG9yLW5hdnktOTAwKScgfX0+XG4gICAgICAgICAgICAgICAgPFBhcGVyY2xpcCBzaXplPXsxNH0gLz4gRXZpZGVuY2UgRmlsZXMgKHtldmlkZW5jZS5sZW5ndGh9KVxuICAgICAgICAgICAgICA8L2gzPlxuICAgICAgICAgICAgICB7KGNhbk1hbmFnZU93blJlcXVlc3QgfHwgaXNBc3NpZ25lZFRvTWUgfHwgaXNTZW5pb3IpICYmIChcbiAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwiYnRuIGJ0bi1vdXRsaW5lIHctZnVsbCB0ZXh0LXhzIG1iLTMgY3Vyc29yLXBvaW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgIHt1cGxvYWRpbmdFdmlkZW5jZSA/IDxzcGFuIGNsYXNzTmFtZT1cInNwaW5uZXJcIiAvPiA6IDxVcGxvYWQgc2l6ZT17MTN9IC8+fVxuICAgICAgICAgICAgICAgICAge3VwbG9hZGluZ0V2aWRlbmNlID8gJ1VwbG9hZGluZy4uLicgOiAnQWRkIEV2aWRlbmNlJ31cbiAgICAgICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwiZmlsZVwiXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImhpZGRlblwiXG4gICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXt1cGxvYWRpbmdFdmlkZW5jZX1cbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9e3VwbG9hZEV2aWRlbmNlfVxuICAgICAgICAgICAgICAgICAgICBhY2NlcHQ9XCIucGRmLC5kb2MsLmRvY3gsLnhscywueGxzeCwuanBnLC5qcGVnLC5wbmdcIlxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICB7ZXZpZGVuY2UubGVuZ3RoID09PSAwID8gKFxuICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1zbGF0ZS00MDAgdGV4dC1jZW50ZXIgcHktM1wiPk5vIGV2aWRlbmNlIGF0dGFjaGVkPC9wPlxuICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgIDx1bCBjbGFzc05hbWU9XCJzcGFjZS15LTJcIj5cbiAgICAgICAgICAgICAgICAgIHtldmlkZW5jZS5tYXAoZiA9PiAoXG4gICAgICAgICAgICAgICAgICAgIDxsaSBrZXk9e2YuaWR9XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgcC0yIHJvdW5kZWQtbGdcIlxuICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IGJhY2tncm91bmQ6ICd2YXIoLS1jb2xvci1zbGF0ZS01MCknIH19PlxuICAgICAgICAgICAgICAgICAgICAgIDxGaWxlVGV4dCBzaXplPXsxNH0gY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS00MDAgZmxleC1zaHJpbmstMFwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTEgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtc2xhdGUtNzAwIHRydW5jYXRlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtmLm9yaWdpbmFsX2ZpbGVuYW1lfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNsYXRlLTQwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0KG5ldyBEYXRlKGYudXBsb2FkZWRfYXQpLCAnTU1NIGQsIHl5eXknKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8YVxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gZG93bmxvYWRFdmlkZW5jZShmLmlkLCBmLm9yaWdpbmFsX2ZpbGVuYW1lKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtc2xhdGUtNDAwIGhvdmVyOnRleHQtbmF2eS05MDAgdHJhbnNpdGlvbi1jb2xvcnMgY3Vyc29yLXBvaW50ZXJcIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxEb3dubG9hZCBzaXplPXsxM30gLz5cbiAgICAgICAgICAgICAgICAgICAgICA8L2E+XG4gICAgICAgICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICA8L3VsPlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cblxuICAgICAgICAgIHsvKiBUaW1lbGluZSAqL31cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNhcmQgcC01XCI+XG4gICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LWJvbGQgbWItM1wiIHN0eWxlPXt7IGNvbG9yOiAndmFyKC0tY29sb3ItbmF2eS05MDApJyB9fT5cbiAgICAgICAgICAgICAgVGltZWxpbmVcbiAgICAgICAgICAgIDwvaDM+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMiB0ZXh0LXhzIHRleHQtc2xhdGUtNTAwXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWJldHdlZW5cIj5cbiAgICAgICAgICAgICAgICA8c3Bhbj5DcmVhdGVkPC9zcGFuPlxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtbWVkaXVtXCI+XG4gICAgICAgICAgICAgICAgICB7Zm9ybWF0KG5ldyBEYXRlKGNhc2VEYXRhLmNyZWF0ZWRfYXQpLCAnTU1NIGQsIHl5eXknKX1cbiAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuXCI+XG4gICAgICAgICAgICAgICAgPHNwYW4+TGFzdCBVcGRhdGVkPC9zcGFuPlxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtbWVkaXVtXCI+XG4gICAgICAgICAgICAgICAgICB7Zm9ybWF0KG5ldyBEYXRlKGNhc2VEYXRhLnVwZGF0ZWRfYXQpLCAnTU1NIGQsIHl5eXkgSEg6bW0nKX1cbiAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICB7LyogSW52ZXN0aWdhdG9yIHJlc3RyaWN0aW9uIG5vdGUgKi99XG4gICAgICAgICAge2lzSW52ZXN0aWdhdG9yICYmIChcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm91bmRlZC14bCBwLTMgZmxleCBpdGVtcy1zdGFydCBnYXAtMlwiXG4gICAgICAgICAgICAgIHN0eWxlPXt7IGJhY2tncm91bmQ6ICdyZ2JhKDYsMTUsMzAsMC4wNCknLCBib3JkZXI6ICcxcHggc29saWQgcmdiYSg2LDE1LDMwLDAuMSknIH19PlxuICAgICAgICAgICAgICA8U2hpZWxkIHNpemU9ezEzfSBjbGFzc05hbWU9XCJmbGV4LXNocmluay0wIG10LTAuNVwiIHN0eWxlPXt7IGNvbG9yOiAndmFyKC0tY29sb3ItbmF2eS05MDApJyB9fSAvPlxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtc2xhdGUtNTAwIGxlYWRpbmctcmVsYXhlZFwiPlxuICAgICAgICAgICAgICAgIFlvdSBjYW5ub3QgZWRpdCwgZGVsZXRlLCBvciBhbHRlciBvcmlnaW5hbCByZXBvcnQgY29udGVudC4gQWxsIHlvdXIgYWN0aW9ucyBhcmUgcGVybWFuZW50bHkgbG9nZ2VkLlxuICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufVxuIl19
