"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  DollarSign,
  ImagePlus,
  Loader2,
  MapPin,
  Sparkles,
  Tag,
  Trash2,
  Upload,
} from "@/shared/icons";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSubcategoriesForCategory,
  PRODUCT_CATEGORIES,
  PRODUCT_CONDITIONS,
} from "@/features/marketplace/constants/marketplaceConstants";
import { getCurrencyForCountry } from "@/features/marketplace/utils/countryCurrency";
import {
  CONTACT_CHAT_TAG,
  CONTACT_EMAIL_TAG,
  CONTACT_PHONE_TAG,
  DELIVERY_TAG,
  hasTag,
  PICKUP_TAG,
  stripReservedListingTags,
  URGENT_TAG,
} from "@/features/marketplace/utils/listingTags";
import MarketplaceLocationPicker from "@/features/marketplace/components/MarketplaceLocationPicker";
import { apiClient } from "@/lib/api-client";
import { useImageUpload } from "@/shared/hooks/useImageUpload";
import { useProfile } from "@/shared/hooks/useProfile";
import { Product } from "@/shared/types";
import {
  emptyProfileLocation,
  profileLocationFromDb,
  type ProfileLocationValue,
} from "@/shared/types/location";
import toast from "react-hot-toast";
import Link from "next/link";

const initialFormData = {
  title: "",
  description: "",
  price: "",
  currency: "USD" as Product["currency"],
  category: PRODUCT_CATEGORIES[0]?.value || "miscellaneous",
  subcategory: "",
  condition: "new",
  country: "",
  tags: "",
  stock_quantity: "1",
  pickupOnly: true,
  deliveryAvailable: false,
  urgentSale: false,
  featuredListing: false,
  contactChat: true,
  contactEmail: false,
  contactPhone: false,
  contactPhoneNumber: "",
};

function formDataFromProduct(product: Product) {
  const tags = Array.isArray(product.tags) ? product.tags : [];
  const userTags = stripReservedListingTags(tags);
  const categoryExists = PRODUCT_CATEGORIES.some((c) => c.value === product.category);

  return {
    title: product.title || "",
    description: product.description || "",
    price: product.price != null ? String(product.price) : "",
    currency: (product.currency || "USD") as Product["currency"],
    category: categoryExists
      ? product.category
      : PRODUCT_CATEGORIES[0]?.value || "miscellaneous",
    subcategory: product.subcategory || "",
    condition: product.condition || "new",
    country: product.country || "",
    tags: userTags.join(", "),
    stock_quantity: String(product.stock_quantity ?? 1),
    pickupOnly: hasTag(tags, PICKUP_TAG) || (!hasTag(tags, DELIVERY_TAG) && !hasTag(tags, PICKUP_TAG)),
    deliveryAvailable:
      hasTag(tags, DELIVERY_TAG) || Boolean(product.shipping_available),
    urgentSale: hasTag(tags, URGENT_TAG),
    featuredListing: Boolean(product.is_featured),
    contactChat: hasTag(tags, CONTACT_CHAT_TAG) || !tags.some((t) => t.startsWith("contact:")),
    contactEmail: hasTag(tags, CONTACT_EMAIL_TAG),
    contactPhone: hasTag(tags, CONTACT_PHONE_TAG) || Boolean(product.contact_phone?.trim()),
    contactPhoneNumber: product.contact_phone || "",
  };
}

function locationFromProduct(product: Product): ProfileLocationValue {
  const label = product.location?.trim() || "";
  return {
    ...emptyProfileLocation(),
    formattedAddress: label,
    address: label,
    city: label,
    country: product.country || "",
    latitude: product.latitude ?? null,
    longitude: product.longitude ?? null,
  };
}

interface CreateProductFormProps {
  /** When set, form loads this listing and saves via PATCH. */
  productId?: string;
  onSuccess?: (productId?: string) => void;
  onCancel?: () => void;
}

const fieldClassName =
  "w-full px-4 py-3 bg-surface-input border border-transparent rounded-xl text-sm text-content placeholder:text-content-tertiary focus:outline-none focus:bg-surface focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all";

const labelClassName = "block text-sm font-semibold text-content mb-2";

const CreateProductForm: React.FC<CreateProductFormProps> = ({
  productId,
  onSuccess,
  onCancel,
}) => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const isEditMode = Boolean(productId);
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(isEditMode);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [formData, setFormData] = useState(initialFormData);
  const [listingLocation, setListingLocation] = useState<ProfileLocationValue>(
    emptyProfileLocation()
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hydratedProductIdRef = useRef<string | null>(null);
  const onCancelRef = useRef(onCancel);
  const { uploadMultipleImages, uploadProgress } = useImageUpload();

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  const listingCurrency = useMemo(
    () => getCurrencyForCountry(profile?.country),
    [profile?.country]
  );

  const subcategoryOptions = useMemo(
    () => getSubcategoriesForCategory(formData.category),
    [formData.category]
  );

  useEffect(() => {
    if (!productId || !user) return;

    let cancelled = false;

    const loadProduct = async () => {
      try {
        setLoadingProduct(true);
        const res = await apiClient.get<{ data: Product }>(`/api/marketplace/${productId}`);
        const product = res.data;
        if (!product || cancelled) return;

        if (product.seller_id && product.seller_id !== user.id) {
          toast.error("You can only edit your own listings");
          onCancelRef.current?.();
          return;
        }

        const nextForm = formDataFromProduct(product);
        const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];

        setFormData(nextForm);
        setUploadedImages(images);
        setPreviewImages(images);
        setListingLocation(locationFromProduct(product));
        hydratedProductIdRef.current = productId;
      } catch (error: unknown) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Failed to load listing for editing";
        toast.error(message);
        onCancelRef.current?.();
      } finally {
        if (!cancelled) setLoadingProduct(false);
      }
    };

    void loadProduct();
    return () => {
      cancelled = true;
    };
  }, [productId, user]);

  useEffect(() => {
    if (!profile) return;
    setFormData((prev) => ({
      ...prev,
      currency: listingCurrency.code,
      country: profile.country || "",
    }));
    // Don't overwrite listing location after hydrating an existing product.
    if (hydratedProductIdRef.current) return;
    setListingLocation((prev) => {
      const hasSelection =
        prev.city?.trim() || prev.formattedAddress?.trim() || prev.country?.trim();
      if (hasSelection) return prev;
      return profileLocationFromDb(profile);
    });
  }, [profile, listingCurrency.code]);

  useEffect(() => {
    setFormData((prev) => {
      const stillValid = subcategoryOptions.some((s) => s.value === prev.subcategory);
      if (stillValid) return prev;
      // While loading an existing product, keep subcategory until options catch up.
      if (loadingProduct && prev.subcategory) return prev;
      return { ...prev, subcategory: subcategoryOptions[0]?.value || "" };
    });
  }, [subcategoryOptions, loadingProduct]);

  const isUploading = uploadProgress.status === "uploading";
  const hasSignupCountry = Boolean(profile?.country?.trim());
  const canSubmit =
    !loading &&
    !loadingProduct &&
    !profileLoading &&
    hasSignupCountry &&
    !isUploading &&
    uploadedImages.length > 0 &&
    formData.title.trim() &&
    formData.description.trim() &&
    formData.price &&
    formData.category &&
    formData.subcategory &&
    (formData.pickupOnly || formData.deliveryAvailable);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (uploadedImages.length + files.length > 5) {
      toast.error("Maximum 5 images allowed");
      return;
    }

    const previews = files.map((file) => URL.createObjectURL(file));
    setPreviewImages((prev) => [...prev, ...previews]);

    try {
      const urls = await uploadMultipleImages(files);
      setUploadedImages((prev) => [...prev, ...urls]);
      toast.success(`${files.length} image(s) uploaded`);
    } catch {
      toast.error("Failed to upload images");
      setPreviewImages((prev) => prev.slice(0, -files.length));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
    setPreviewImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error(
        isEditMode
          ? "You must be logged in to update a listing"
          : "You must be logged in to create a listing"
      );
      return;
    }

    if (uploadedImages.length === 0) {
      toast.error("Please upload at least one product image");
      return;
    }

    if (!formData.subcategory) {
      toast.error("Please select a subcategory");
      return;
    }

    if (!formData.pickupOnly && !formData.deliveryAvailable) {
      toast.error("Select pickup and/or delivery");
      return;
    }

    try {
      setLoading(true);

      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const locationLabel =
        listingLocation.city?.trim() ||
        listingLocation.formattedAddress?.trim() ||
        null;

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        category: formData.category,
        subcategory: formData.subcategory,
        condition: formData.condition,
        location: locationLabel,
        latitude: listingLocation.latitude ?? undefined,
        longitude: listingLocation.longitude ?? undefined,
        images: uploadedImages,
        tags,
        stock_quantity: parseInt(formData.stock_quantity, 10) || 1,
        pickup_only: formData.pickupOnly,
        delivery_available: formData.deliveryAvailable,
        shipping_available: formData.deliveryAvailable,
        urgent_sale: formData.urgentSale,
        is_featured: formData.featuredListing,
        contact_chat: formData.contactChat,
        contact_email: formData.contactEmail,
        contact_phone_pref: formData.contactPhone,
        contact_phone: formData.contactPhoneNumber.trim() || undefined,
      };

      if (isEditMode && productId) {
        await apiClient.patch(`/api/marketplace/${productId}`, payload);
        toast.success("Listing updated successfully!");
        onSuccess?.(productId);
      } else {
        const res = await apiClient.post<{ data: { id: string } }>(
          "/api/marketplace",
          payload
        );
        toast.success("Listing published successfully!");
        onSuccess?.(res.data?.id);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : isEditMode
            ? "Failed to update listing"
            : "Failed to create listing";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingProduct) {
    return (
      <div className="bg-surface rounded-2xl border border-border-subtle p-6 text-sm text-content-secondary flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
        Loading listing details…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {profileLoading ? (
        <div className="bg-surface rounded-2xl border border-border-subtle p-6 text-sm text-content-secondary">
          Loading your profile…
        </div>
      ) : !hasSignupCountry ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          Add your signup country in{" "}
          <Link href="/profile" className="font-semibold text-primary-600 hover:underline">
            profile settings
          </Link>{" "}
          before {isEditMode ? "updating" : "publishing"} a listing.
        </div>
      ) : null}

      <section className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center">
            <Camera className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-content">Images</h2>
            <p className="text-xs text-content-secondary">Add up to 5 photos. The first photo is your cover.</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={handleImageSelect}
          className="hidden"
        />

        {previewImages.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
            {previewImages.map((preview, index) => (
              <div key={index} className="relative group aspect-square">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover rounded-xl border border-border"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {index === 0 && (
                  <span className="absolute bottom-2 left-2 bg-primary-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Cover
                  </span>
                )}
              </div>
            ))}
            {previewImages.length < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary-400 hover:bg-primary-50/50 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50"
              >
                <ImagePlus className="w-6 h-6 text-content-tertiary" />
                <span className="text-xs text-content-secondary">Add more</span>
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full py-10 sm:py-12 rounded-2xl border-2 border-dashed border-border bg-surface-input hover:border-primary-400 hover:bg-primary-50/40 transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                <span className="text-sm font-medium text-content">
                  Uploading… {Math.round(uploadProgress.progress)}%
                </span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-content-tertiary" />
                <span className="text-sm font-semibold text-content">
                  Click to upload listing images
                </span>
                <span className="text-xs text-content-secondary">
                  Maximum 5 images · Up to 10MB each
                </span>
                <span className="text-xs text-content-tertiary">JPG, PNG, GIF, WebP</span>
              </>
            )}
          </button>
        )}
      </section>

      <section className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-4 sm:p-6 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-content">Listing details</h2>
            <p className="text-xs text-content-secondary">Help buyers understand what you&apos;re selling.</p>
          </div>
        </div>

        <div>
          <label className={labelClassName} htmlFor="title">
            Listing title <span className="text-primary-600">*</span>
          </label>
          <input
            id="title"
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Solid wood dining table, seats 6"
            className={fieldClassName}
            maxLength={120}
          />
          <p className="text-xs text-content-tertiary mt-1.5">{formData.title.length}/120 characters</p>
        </div>

        <div>
          <label className={labelClassName} htmlFor="description">
            Description <span className="text-primary-600">*</span>
          </label>
          <textarea
            id="description"
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe your listing — materials, size, condition, and anything buyers should know."
            rows={5}
            className={`${fieldClassName} resize-y min-h-[120px]`}
          />
        </div>
      </section>

      <section className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-4 sm:p-6 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-content">Price</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className={labelClassName} htmlFor="price">
                Price <span className="text-primary-600">*</span>
              </label>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 shrink-0">
                {listingCurrency.label}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-content-secondary">
                {listingCurrency.symbol}
              </span>
              <input
                id="price"
                type="number"
                required
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
                className={`${fieldClassName} pl-10`}
                disabled={!hasSignupCountry}
              />
            </div>
          </div>
          <div>
            <label className={labelClassName} htmlFor="stock">
              Stock quantity <span className="text-primary-600">*</span>
            </label>
            <input
              id="stock"
              type="number"
              required
              min="1"
              value={formData.stock_quantity}
              onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
              className={fieldClassName}
              disabled={!hasSignupCountry}
            />
          </div>
        </div>
      </section>

      <section className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-4 sm:p-6 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center">
            <Tag className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-content">Category & condition</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClassName} htmlFor="category">
              Category <span className="text-primary-600">*</span>
            </label>
            <select
              id="category"
              required
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value, subcategory: "" })
              }
              className={fieldClassName}
            >
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClassName} htmlFor="subcategory">
              Subcategory <span className="text-primary-600">*</span>
            </label>
            <select
              id="subcategory"
              required
              value={formData.subcategory}
              onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
              className={fieldClassName}
            >
              {subcategoryOptions.length === 0 ? (
                <option value="">No subcategories</option>
              ) : (
                subcategoryOptions.map((sub) => (
                  <option key={sub.value} value={sub.value}>
                    {sub.label}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName} htmlFor="condition">
              Condition <span className="text-primary-600">*</span>
            </label>
            <select
              id="condition"
              required
              value={formData.condition}
              onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
              className={fieldClassName}
            >
              {PRODUCT_CONDITIONS.map((cond) => (
                <option key={cond.value} value={cond.value}>
                  {cond.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-4 sm:p-6 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-content">Location & fulfillment</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClassName}>Location</label>
            <MarketplaceLocationPicker
              location={listingLocation}
              onLocationChange={setListingLocation}
              showRadius={false}
              triggerVariant="field"
              disabled={!hasSignupCountry}
            />
          </div>
          <div>
            <label className={labelClassName}>Country</label>
            <div className="px-4 py-3 bg-surface-input border border-transparent rounded-xl text-sm text-content">
              {profile?.country || "—"}
            </div>
            <p className="text-xs text-content-secondary mt-1.5">From your signup profile</p>
          </div>
        </div>

        <div>
          <p className={labelClassName}>Pickup / delivery <span className="text-primary-600">*</span></p>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-center gap-2 text-sm text-content cursor-pointer">
              <input
                type="checkbox"
                checked={formData.pickupOnly}
                onChange={(e) => setFormData({ ...formData, pickupOnly: e.target.checked })}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Pickup only
            </label>
            <label className="flex items-center gap-2 text-sm text-content cursor-pointer">
              <input
                type="checkbox"
                checked={formData.deliveryAvailable}
                onChange={(e) =>
                  setFormData({ ...formData, deliveryAvailable: e.target.checked })
                }
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Delivery available
            </label>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex items-center gap-2 text-sm text-content cursor-pointer">
            <input
              type="checkbox"
              checked={formData.urgentSale}
              onChange={(e) => setFormData({ ...formData, urgentSale: e.target.checked })}
              className="rounded border-border text-primary-600 focus:ring-primary-500"
            />
            Urgent sale
          </label>
          <label className="flex items-center gap-2 text-sm text-content cursor-pointer">
            <input
              type="checkbox"
              checked={formData.featuredListing}
              onChange={(e) =>
                setFormData({ ...formData, featuredListing: e.target.checked })
              }
              className="rounded border-border text-primary-600 focus:ring-primary-500"
            />
            Featured listing
          </label>
        </div>

        <div>
          <p className={labelClassName}>Contact preferences</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-content cursor-pointer">
              <input
                type="checkbox"
                checked={formData.contactChat}
                onChange={(e) => setFormData({ ...formData, contactChat: e.target.checked })}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              In-app chat
            </label>
            <label className="flex items-center gap-2 text-sm text-content cursor-pointer">
              <input
                type="checkbox"
                checked={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.checked })}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Email
            </label>
            <label className="flex items-center gap-2 text-sm text-content cursor-pointer">
              <input
                type="checkbox"
                checked={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.checked })}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Phone
            </label>
          </div>
          {formData.contactPhone && (
            <input
              type="tel"
              value={formData.contactPhoneNumber}
              onChange={(e) =>
                setFormData({ ...formData, contactPhoneNumber: e.target.value })
              }
              placeholder="Phone number"
              className={`${fieldClassName} mt-3`}
            />
          )}
        </div>

        <div>
          <label className={labelClassName} htmlFor="tags">
            Tags
          </label>
          <input
            id="tags"
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="handmade, local, vintage (comma-separated)"
            className={fieldClassName}
          />
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 px-4 py-4 bg-surface/95 backdrop-blur border-t border-border-subtle sm:static sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent sm:border-0 sm:backdrop-blur-none">
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 rounded-xl border border-border text-content font-semibold text-sm hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-8 py-3 rounded-xl bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEditMode ? "Saving…" : "Publishing…"}
              </>
            ) : isEditMode ? (
              "Save changes"
            ) : (
              "Publish listing"
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export default CreateProductForm;
