import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CircleCheck,
  CreditCard,
  LockKeyhole,
  Maximize2,
  Star,
  TvMinimalPlay,
  Upload,
  X,
} from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "../contexts/ToastContext";
import { fetchCourseById } from "../services/courseService";
import { createPayment } from "../services/paymentService";
import { fetchPaymentSettings } from "../services/paymentSettingsService";
import { validateFileSize } from "../utils/fileValidation";

const paymentSteps = ["Payment", "Upload Receipt", "Verification"];

function Payment() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [paymentQr, setPaymentQr] = useState("");
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptName, setReceiptName] = useState("");
  const [receiptPreview, setReceiptPreview] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    async function loadCourse() {
      try {
        setLoading(true);
        setError("");
        const [loadedCourse, paymentSettings] = await Promise.all([
          fetchCourseById(courseId),
          fetchPaymentSettings(),
        ]);
        setCourse(loadedCourse);
        setPaymentQr(loadedCourse.paymentQr || paymentSettings.paymentQr || "");
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadCourse();
  }, [courseId]);

  useEffect(() => {
    return () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    };
  }, [receiptPreview]);

  const handleReceiptChange = (e) => {
    const file = e.target.files?.[0];
    const sizeError = validateFileSize(file, "Receipt image");

    if (sizeError) {
      setReceiptFile(null);
      setReceiptName("");
      setReceiptPreview("");
      setError(sizeError);
      e.target.value = "";
      return;
    }

    setReceiptFile(file || null);
    setReceiptName(file?.name || "");
    setReceiptPreview(file ? URL.createObjectURL(file) : "");
    setError("");
  };

  const handleUploadReceipt = async () => {
    if (!receiptFile) {
      setError("Please upload your payment receipt first.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await createPayment(courseId, receiptFile);
      showToast({
        title: "Payment submitted",
        message: "Your receipt has been uploaded and is pending review.",
        type: "success",
      });
      setCurrentStep(3);
    } catch (submitError) {
      setError(submitError.message);
      showToast({
        title: "Upload failed",
        message: submitError.message,
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <LoadingSpinner message="Loading course..." />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <p className="text-2xl text-gray-600">
            {error || "Course not found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF8] text-[#2D2E30]">
      <Navbar />

      <div className="bg-[#FFF9EA] px-4 pt-6 sm:px-6 sm:pt-8 md:px-10">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate(`/enroll/${courseId}`)}
            className="inline-flex items-center gap-2 text-sm font-bold text-[#765F55] transition hover:text-[#C97112]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to order summary
          </button>
        </div>
      </div>

      <main className="bg-[#FFF9EA] px-4 pb-14 pt-8 sm:px-6 sm:pb-16 md:px-10 md:pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10 md:mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Secure checkout</p>
            <h1 className="mt-3 text-[clamp(1.65rem,5vw,2.65rem)] font-bold leading-[1.15] tracking-tight text-[#2D2E30]">
              Complete your <span className="font-serif font-normal italic text-[#B96128]">enrollment.</span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-[#765F55] sm:text-base">Pay securely, upload your receipt, and we’ll take care of the verification.</p>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
            <aside className="md:col-span-1 lg:col-span-2">
              <div className="overflow-hidden rounded-[1.75rem] border border-[#2D2E30]/10 bg-white p-4 shadow-[0_22px_55px_-40px_rgba(80,48,19,0.45)] sm:p-6 md:p-8 lg:sticky lg:top-20">
                <div className="mb-5 overflow-hidden rounded-[1.3rem] bg-[#F3E9D9] sm:mb-6">
                {course.image ? (
                  <img
                    src={course.image}
                    alt={course.title}
                    className="h-48 w-full object-cover sm:h-56 md:h-64"
                  />
                ) : (
                  <div className="flex h-48 w-full items-center justify-center text-sm text-[#765F55] sm:h-56 md:h-64">
                    No image
                  </div>
                )}
              </div>

                <span className="inline-block rounded-full border border-[#E58C1A]/20 bg-[#FFF4D8] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#C97112]">Your selected course</span>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl">{course.title}</h2>
                <div className="mt-4 flex flex-col gap-3 border-y border-[#2D2E30]/10 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
                    <div className="flex items-center gap-2">
                      <TvMinimalPlay
                        className="h-5 w-5 text-[#E58C1A]"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span className="text-[#2D2E30] font-semibold text-sm sm:text-base">
                        {course.lessons} lessons
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 fill-[#F4B63F] text-[#F4B63F]" aria-hidden="true" />
                      <span className="text-[#2D2E30] font-semibold text-sm sm:text-base">
                        ({course.rating.toFixed(1)}/5)
                      </span>
                    </div>
                </div>
                <div className="mt-5 flex items-end justify-between gap-4">
                  <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#765F55]">Total</p><p className="mt-1 text-2xl font-bold text-[#B96128]">{course.price}</p></div>
                  <CreditCard className="h-6 w-6 text-[#E58C1A]" aria-hidden="true" />
                </div>
              </div>
            </aside>

            <section className="overflow-hidden rounded-[1.75rem] border border-[#2D2E30]/10 bg-white shadow-[0_22px_55px_-40px_rgba(80,48,19,0.45)] md:col-span-1 lg:col-span-1">
              <div className="relative overflow-hidden bg-[#2D2E30] px-5 py-6 sm:px-6 sm:py-7 md:px-8">
                <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#F8C56A]/15" aria-hidden="true" />
                <div className="absolute -bottom-20 right-24 h-32 w-32 rounded-full border border-white/10" aria-hidden="true" />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[#F8C56A]"><span className="h-1.5 w-1.5 rounded-full bg-[#F8C56A]" /><p className="text-xs font-bold uppercase tracking-[0.18em]">Secure payment</p></div>
                    <h2 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">Finish your payment</h2>
                    <p className="mt-2 max-w-md text-xs leading-relaxed text-white/65 sm:text-sm">Scan, pay, then upload your receipt. Your course access will be ready once it’s verified.</p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-[#F8C56A] sm:h-12 sm:w-12"><LockKeyhole className="h-5 w-5" aria-hidden="true" /></div>
                </div>
              </div>

              <div className="mx-5 mt-5 rounded-2xl border border-[#2D2E30]/10 bg-[#FFF9EA] p-2 sm:mx-6 sm:mt-6 md:mx-8">
                <div className="grid grid-cols-3 gap-2">
                  {paymentSteps.map((label, index) => {
                    const stepNumber = index + 1;
                    const isCompleted = currentStep > stepNumber;
                    const isActive = currentStep === stepNumber;

                    return (
                      <div
                        key={label}
                        className={`rounded-xl px-2 py-3 text-center transition-all sm:px-3 ${
                          isActive
                            ? "bg-[#2D2E30] text-white shadow-[0_8px_18px_-10px_rgba(45,46,48,0.8)]"
                            : isCompleted
                              ? "bg-[#FFF1CE] text-[#9A5816]"
                              : "bg-white text-[#9A8775]"
                        }`}
                      >
                        <div className={`mx-auto mb-2 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                          isActive
                            ? "bg-[#F8C56A] text-[#2D2E30]"
                            : isCompleted
                              ? "bg-[#E58C1A] text-white"
                              : "bg-[#F1E8DC] text-[#9A8775]"
                        }`}>
                          {isCompleted ? "✓" : stepNumber}
                        </div>
                        <p className="text-[10px] font-bold leading-tight sm:text-xs">{label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6 md:px-8 md:pb-8">
              {/* Step 1 — QR Code */}
              {currentStep === 1 ? (
                <div className="space-y-4 sm:space-y-5 md:space-y-6">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFF4D8] text-xs font-bold text-[#C97112]">1</span>
                    <div><p className="font-semibold text-sm text-[#2D2E30] sm:text-base mb-2">
                      Step 1. Scan the QR code to complete your payment.
                    </p>
                    <p className="text-xs sm:text-sm text-[#765F55]">
                      Next step: Upload your payment receipt.
                    </p></div>
                  </div>

                  <div className="rounded-2xl border border-[#2D2E30]/10 bg-[#FFF9EA] p-4 sm:p-6 flex items-center justify-center">
                    {paymentQr ? (
                      <button
                        type="button"
                        onClick={() => setQrPreviewOpen(true)}
                        className="group relative rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2"
                        aria-label="Open payment QR preview"
                      >
                        <img
                          src={paymentQr}
                          alt="Bank QR code for payment"
                          className="h-40 w-40 object-contain transition-transform group-hover:scale-[1.02] sm:h-56 sm:w-56"
                        />
                        <div className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <div className="rounded-lg bg-[#2D2E30] p-1.5 text-white shadow-sm">
                            <Maximize2 size={12} />
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div className="flex h-40 w-40 items-center justify-center px-3 text-center text-xs text-[#765F55] sm:h-56 sm:w-56 sm:text-sm">
                        Payment QR is not available yet. Please contact support.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => navigate(`/courses/${courseId}`)}
                      className="flex-1 rounded-xl border border-[#2D2E30]/20 px-4 py-3 text-sm font-bold text-[#2D2E30] transition hover:bg-[#FFF9EA] sm:text-base"
                    >
                      Go Back
                    </button>
                    <button
                      onClick={() => {
                        setCurrentStep(2);
                        setError(""); // Clear error when moving to step 2
                      }}
                      className="flex-1 rounded-xl bg-[#F8C56A] px-4 py-3 text-sm font-bold text-[#2D2E30] transition hover:bg-[#E58C1A] sm:text-base"
                    >
                      Upload Receipt
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Step 2 — Upload Receipt */}
              {currentStep === 2 ? (
                <div className="space-y-4 sm:space-y-5 md:space-y-6">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFF4D8] text-xs font-bold text-[#C97112]">2</span>
                    <div><p className="font-semibold text-sm text-[#2D2E30] sm:text-base mb-2">
                      Step 2. Upload your payment receipt.
                    </p>
                    <p className="text-xs sm:text-sm text-[#765F55]">
                      Please upload a clear image or screenshot of your payment
                      confirmation.
                    </p></div>
                  </div>

                  <label className={`block cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center transition sm:p-5 ${
                    receiptFile
                      ? "border-[#7EAF85] bg-[#F4FAF4]"
                      : "border-[#D9CEBE] bg-[#FFFDF8] hover:border-[#E58C1A] hover:bg-[#FFF9EA]"
                  }`}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptChange}
                      className="hidden"
                    />
                    {receiptFile && receiptPreview ? (
                      <div className="flex items-center gap-3 text-left">
                        <img src={receiptPreview} alt="Selected payment receipt preview" className="h-16 w-16 shrink-0 rounded-xl border border-[#7EAF85]/30 bg-white object-cover sm:h-20 sm:w-20" />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-1.5 text-[#4D7C57]"><CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="text-xs font-bold uppercase tracking-[0.1em]">Receipt ready</span></div>
                          <p className="truncate text-sm font-bold text-[#2D2E30]">{receiptName}</p>
                          <p className="mt-1 text-xs text-[#4D7C57]">{(receiptFile.size / 1024 / 1024).toFixed(2)} MB · Tap to replace</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF4D8] text-[#C97112]"><Upload className="h-5 w-5" aria-hidden="true" /></div>
                        <p className="mb-1 text-sm font-semibold text-[#2D2E30] sm:text-base">Click to upload receipt</p>
                        <p className="text-xs text-[#765F55] sm:text-sm">PNG or JPG, max 5 MB</p>
                      </>
                    )}
                  </label>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => {
                        setCurrentStep(1);
                        setError(""); // Clear error when going back to step 1
                      }}
                      className="flex-1 rounded-xl border border-[#2D2E30]/20 px-4 py-3 text-sm font-bold text-[#2D2E30] transition hover:bg-[#FFF9EA] sm:text-base"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleUploadReceipt}
                      disabled={submitting}
                      className="flex-1 rounded-xl bg-[#F8C56A] px-4 py-3 text-sm font-bold text-[#2D2E30] transition hover:bg-[#E58C1A] sm:text-base disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? "Submitting..." : "Submit Payment"}
                    </button>
                  </div>

                  {/* Error message under submit button */}
                  {error ? (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Step 3 — Confirmation */}
              {currentStep === 3 ? (
                <div className="space-y-4 sm:space-y-5 md:space-y-6">
                  <div>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E9F4EA] text-[#4D7C57]"><CircleCheck className="h-6 w-6" aria-hidden="true" /></div>
                    <h4 className="text-lg sm:text-xl font-bold text-[#2D2E30] mb-2 sm:mb-3">
                      Payment under review
                    </h4>
                    <p className="text-xs sm:text-sm text-[#765F55] leading-relaxed">
                      Your payment has been submitted successfully. You will be
                      notified once your enrollment is approved.
                    </p>
                  </div>

                  <button
                    onClick={() => navigate("/my-course-order")}
                    className="w-full rounded-xl bg-[#F8C56A] px-4 py-3 text-sm font-bold text-[#2D2E30] transition hover:bg-[#E58C1A] sm:text-base"
                  >
                    View My Course Orders
                  </button>
                </div>
              ) : null}
              </div>
            </section>
          </div>
        </div>
      </main>

      {qrPreviewOpen && paymentQr ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-4 shadow-2xl sm:p-5">
            <button
              type="button"
              onClick={() => setQrPreviewOpen(false)}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close QR preview"
            >
              <X size={20} />
            </button>

            <img
              src={paymentQr}
              alt="Enlarged bank QR code for payment"
              className="mx-auto mt-6 max-h-[70vh] w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  );
}

export default Payment;
