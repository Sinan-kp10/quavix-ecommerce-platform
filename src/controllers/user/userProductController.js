import userModel from "../../models/userModal.js"
import productModel from "../../models/productModal.js"
import categoryModel from "../../models/category.js"
import wishlistModel from "../../models/wishlistModel.js"
import cartModel from "../../models/cartModel.js"
import walletModel from "../../models/walletModel.js"
import couponsModel from "../../models/couponsModel.js"


import {

    getFilterdProduct,
    findProducts,
    addWishlistService,
    addToCartService,
    removeFromCartService,
    updateCartQuantityService,
    

} from "../../services/user/userProductService.js"



export const loadProducts = async (req, res) => {
    try {

        const page = Number(req.query.page) || 1;
        const limit = 6;
        const category = req.query.category || null;

        const result = await getFilterdProduct(
            category,
            null,
            null,
            null,
            page,
            limit
        );

        const categories = await categoryModel.find({ status: "Active" });

        const products = await productModel.find({ isDeleted: false }).populate("category");

        let prices = [];

        products.forEach(product => {

            if (product.category?.status !== "Active") return;

            const offer = Math.max(product.offerPercentage || 0, product.category?.categoryOffer || 0);

            product.variants
                .filter(v => v.status === "Active")
                .forEach(variant => {

                    const finalPrice = Math.round(
                        variant.price - (variant.price * offer / 100)
                    );

                    prices.push(finalPrice);
                });

        });

        const minPrice = prices.length ? Math.min(...prices) : 0;
        const maxPrice = prices.length ? Math.max(...prices) : 200000;

        let wishlistItems = [];

        if (req.session.user) {
            const wishlist = await wishlistModel.findOne({
                user: req.session.user.id
            });

            if (wishlist) {
                wishlistItems = wishlist.items.map(item => ({
                    product: item.product.toString(),
                    variant: item.variant.toString()
                }));
            }
        }

        let search=""

        res.render("user/products", {
            title: "products-Quavix",
            css: "userStyle",
            products: result.products,
            categories,
            wishlistItems,
            totalPages: result.totalPages,
            currentPage: page,
            minPrice,
            maxPrice,
            selectedCategory: category,
            search
        });

    } catch (err) {
        console.log(err);
        res.redirect("/");
    }
}

export const filterProducts = async (req, res) => {
    try {

        const { categories, sort, minPrice, maxPrice } = req.query;

        const page = Number(req.query.page) || 1;
        const limit = 6;

        const result = await getFilterdProduct(
            categories,
            sort,
            minPrice,
            maxPrice,
            page,
            limit
        );

        res.json({
            success: true,
            products: result.products,
            totalPages: result.totalPages,
            currentPage: page
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false });
    }
}

export const searchProducts = async (req, res) => {
    try {

        const { q } = req.query
        const {products,search} = await findProducts(q)

        if (!q || q.trim() === "") {
            return res.redirect("/products");
        }

        const categories = await categoryModel.find({})

        let prices = []

        products.forEach(product => {

            if (product.category?.status !== "Active") return;

            const offer = Math.max(product.offerPercentage || 0, product.category?.categoryOffer || 0);

            product.variants.forEach(variant => {

                const finalPrice = Math.round(
                    variant.price - (variant.price * offer / 100)
                )

                prices.push(finalPrice)
            })

        })

        const minPrice = prices.length ? Math.min(...prices) : 0
        const maxPrice = prices.length ? Math.max(...prices) : 200000


        let wishlistItems = []

        if (req.session.user) {
            const wishlist = await wishlistModel.findOne({
                user: req.session.user.id
            })

            if (wishlist) {
                wishlistItems = wishlist.items.map(item => ({
                    product: item.product.toString(),
                    variant: item.variant.toString()
                }))
            }
        }

        res.render("user/products", {
            title: "products-Quavix",
            css: "userStyle",
            products,
            categories,
            searchQuery: q,
            wishlistItems,
            totalPages: 1,
            currentPage: 1,
            minPrice,
            maxPrice,
            search
        })

    } catch (err) {
        res.status(500).json({ success: false })
    }
}

export const getSearchSuggestions = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim() === "") {
            return res.json({ success: true, suggestions: [] });
        }

        const { products } = await findProducts(q);

        // Map to lightweight suggestions object
        const suggestions = products.slice(0, 5).map(product => {
            const activeVariant = product.variants.find(v => v.status === "Active") || product.variants[0];
            const offer = Math.max(product.offerPercentage || 0, product.category?.categoryOffer || 0);
            
            let price = activeVariant ? activeVariant.price : 0;
            if (offer > 0 && price > 0) {
                price = Math.round(price - (price * offer / 100));
            }

            return {
                _id: product._id,
                name: product.name,
                slug: product.slug,
                image: activeVariant?.images?.primary?.url || "",
                price: price
            };
        });

        res.json({ success: true, suggestions });
    } catch (err) {
        console.error("Search suggestion error:", err);
        res.status(500).json({ success: false, suggestions: [] });
    }
}

export const loadProductDetials = async (req, res) => {
    try {
        const { slug } = req.params;
        const { variant } = req.query;

        const product = await productModel.findOne({ slug }).populate("category")

        if (!product) {
            return res.redirect("/products");
        }

        const isBlocked = product.isDeleted || product.category?.status !== "Active";

        let activeVariant;

        if (variant) {
            activeVariant = product.variants.find(v => v._id.toString() === variant);
        }

        if (!activeVariant) {
            activeVariant = product.variants.find(v => v.status === "Active") || product.variants[0];
        }

        const colorVariants = product.variants.filter(v => v.attributes.some(attr => attr.name.toLowerCase() === "color"))

        const relatedProducts = await productModel.find({ _id: { $ne: product._id }, category: product.category._id, isDeleted: false }).populate("category");

        let isWishlisted = false;

        if (req.session.user) {
            const wishlist = await wishlistModel.findOne({
                user: req.session.user.id
            });

            if (wishlist) {
                isWishlisted = wishlist.items.some(item =>
                    item.product.toString() === product._id.toString() &&
                    item.variant.toString() === activeVariant._id.toString()
                );
            }
        }
        const storageVariants = product.variants.filter(v =>
            v.attributes.some(attr =>
                attr.name && (
                    attr.name.toLowerCase().includes("storage") ||
                    attr.name.toLowerCase().includes("rom")
                )
            )
        )

        res.render("user/productDetails", {
            title: `${product.name} - Quavix`,
            css: "userStyle",
            product,
            activeVariant,
            colorVariants,
            storageVariants,
            relatedProducts,
            isWishlisted,
            isBlocked
        })

    } catch (err) {
        console.log(err);
        res.redirect("/products");
    }
}

export const loadWishlist = async (req, res) => {
    try {

        const userId = req.session.user.id;

        if (!userId) {
            return res.redirect("/login");
        }

        const wishlist = await wishlistModel.findOne({ user: userId }).populate({ path: "items.product", populate: { path: "category" } });

        res.render("user/wishlist", {
            title: "My Wishlist - Quavix",
            css: "userStyle",
            wishlist
        });

    } catch (err) {
        console.log(err);
        res.redirect("/");
    }
}

export const AddToWishlist = async (req, res) => {
    try {

        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                loginRequired: true,
                message: "Please login to use wishlist"
            });
        }

        const userId = req.session.user.id
        const { productId, variantId } = req.body;

        const result = await addWishlistService(
            userId,
            productId,
            variantId
        )

        res.json({
            success: true,
            added: result.added,
            wishlistCount: result.count,
            message: result.added
                ? "Added to wishlist"
                : "Removed from wishlist"
        });

    } catch (err) {

        res.status(500).json({ success: false, message: "Something Went Wrong" });
    }
}

export const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { productId, variantId } = req.body;

        await wishlistModel.updateOne(
            { user: userId },
            {
                $pull: {
                    items: {
                        product: productId,
                        variant: variantId
                    }
                }
            }
        )

        res.json({ success: true });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
}

export const loadCart = async (req, res) => {

    try {

        const userId = req.session.user.id;

        const cart = await cartModel.findOne({ user: userId }).populate({ path: "items.product", populate: { path: "category" } });

        res.render("user/cart", {
            title: "My Cart - Quavix",
            css: "userStyle",
            cart

        })

    } catch (err) {

        res.redirect("/");
    }

}

export const addToCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false })
        }

        const userId = req.session.user.id
        const { productId, variantId } = req.body

        const totalQty = await addToCartService(userId, productId, variantId)

        res.json({ success: true, message: "Product added to cart!", cartCount: totalQty })

    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
}

export const removeFromCart = async (req, res) => {
    try {

        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Login required" })
        }

        const userId = req.session.user.id;
        const { productId, variantId } = req.body;

        await removeFromCartService(userId, productId, variantId);

        res.json({
            success: true,
            message: "Product removed from cart"
        });

    } catch (err) {
        console.error("Remove Cart Error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to remove product"
        });
    }
}

export const updateCartQuantity = async (req, res) => {
    try {

        const userId = req.session.user.id;
        const { productId, variantId, type } = req.body;

        const newQty = await updateCartQuantityService(userId, productId, variantId, type)

        res.json({ success: true, quantity: newQty })

    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
}

export const buyNowProduct = async (req, res) => {
    try {

        const { variantId } = req.body

        if (!variantId) {
            return res.json({ success: false, message: "Variant required" });
        }

        const product = await productModel.findOne({ "variants._id": variantId, isDeleted: false })

        if (!product) {
            return res.json({ success: false, message: "Product not found" });
        }

        const variant = product.variants.id(variantId)

        if (!variant || variant.status !== "Active") {
            return res.json({ success: false, message: "Variant not available" });
        }

        if (variant.stock <= 0) {
            return res.json({ success: false, message: "Out of stock" });
        }

        req.session.buyNow = {
            productId: product._id,
            variantId: variant._id,
            quantity: 1
        };

        res.json({ success: true });

    } catch (err) {
        res.json({ success: false, message: "Something went wrong" })
    }
}

export const checkoutFromCart = async (req, res) => {
    try {

        if (!req.session.user || !req.session.user.id) {
            return res.json({
                success: false,
                message: "Please login to continue"
            });
        }

        const cart = await cartModel.findOne({ user: req.session.user.id }).populate({ path: "items.product", populate: { path: "category" } });

        if (!cart || cart.items.length === 0) {
            return res.json({ success: false, message: "Cart empty" });
        }

        for (const item of cart.items) {

            const product = item.product;
            const variant = product.variants.id(item.variant);

            if (!variant || product.isDeleted || product.category?.status !== "Active") {
                return res.json({
                    success: false,
                    message: `${product.name} is no longer available`
                });
            }

            if (variant.stock < item.quantity) {
                return res.json({
                    success: false,
                    message: `${product.name} is out of stock`
                });
            }

        }

        req.session.fromCart = true;
        req.session.buyNow = null;

        res.json({ success: true });

    } catch (err) {
        console.log(err);
        res.json({
            success: false,
            message: "Something went wrong while processing checkout."
        });
    }
}

export const loadCheckout = async (req, res) => {
    try {

        const userId = req.session.user.id;

        const user = await userModel.findById(userId)
        const wallet = await walletModel.findOne({ userId });
        const walletBalance = wallet ? wallet.balance : 0;

        if (req.session.buyNow) {

            const { productId, variantId, quantity } = req.session.buyNow;

            const product = await productModel.findById(productId).populate("category");

            if (!product || product.category?.status !== "Active") {
                return res.redirect("/products");
            }

            const variant = product.variants.id(variantId);

            const offer = Math.max(product.offerPercentage || 0, product.category?.categoryOffer || 0);
            const discount = (variant.price * offer) / 100;
            const finalPrice = Math.round(variant.price - discount);

            const totalMRP = variant.price * quantity;
            const totalDiscount = discount * quantity;
            const subtotal = finalPrice * quantity;

            let couponDiscount = 0;
            let appliedCoupon = null;

            if (req.session.couponCode) {

                const coupon = await couponsModel.findOne({ code: req.session.couponCode });

                if (coupon && coupon.status === "Active" && coupon.expiryDate >= new Date() && subtotal >= coupon.minPurchaseAmount) {
                    appliedCoupon = coupon;
                    if (coupon.couponType === "percentage") {
                        let discount = (subtotal * coupon.discountAmount) / 100;
                        if (coupon.maxDiscountAmount > 0 && discount > coupon.maxDiscountAmount) {
                            discount = coupon.maxDiscountAmount;
                        }
                        couponDiscount = Math.round(discount);
                    } else {
                        couponDiscount = coupon.discountAmount;
                    }
                }
            }

            const finalTotal = Math.max(0, subtotal - couponDiscount);

            const coupons = await couponsModel.find({
                status: "Active",
                expiryDate: { $gte: new Date() },
                minPurchaseAmount: { $lte: subtotal }
            })
            return res.render("user/checkout", {
                title: "Checkout - Quavix",
                css: "userStyle",
                user,
                product,
                variant,
                quantity,
                subtotal,
                totalMRP,
                totalDiscount,
                couponDiscount,
                finalTotal,
                appliedCoupon,
                coupons,
                walletBalance,
                cancelUrl: `/product/${product.slug}`
            });
        }

        if (req.session.fromCart) {

            const cart = await cartModel.findOne({ user: userId }).populate({ path: "items.product", populate: { path: "category" } });

            if (!cart || cart.items.length === 0) {
                return res.redirect("/cart");
            }

            let totalMRP = 0;
            let totalDiscount = 0;
            let subtotal = 0;

            cart.items.forEach(item => {

                const product = item.product;
                const variant = product.variants.id(item.variant);
                if (!variant || product.category?.status !== "Active") return;

                const offer = Math.max(product.offerPercentage || 0, product.category?.categoryOffer || 0);
                const discount = (variant.price * offer) / 100;
                const finalPrice = variant.price - discount;

                totalMRP += variant.price * item.quantity;
                totalDiscount += discount * item.quantity;
                subtotal += finalPrice * item.quantity;
            })
            let couponDiscount = 0;
            let appliedCoupon = null;

            if (req.session.couponCode) {

                const coupon = await couponsModel.findOne({ code: req.session.couponCode });

                if (coupon && coupon.status === "Active" && coupon.expiryDate >= new Date() && subtotal >= coupon.minPurchaseAmount) {
                    appliedCoupon = coupon;
                    if (coupon.couponType === "percentage") {
                        let discount = (subtotal * coupon.discountAmount) / 100;
                        if (coupon.maxDiscountAmount > 0 && discount > coupon.maxDiscountAmount) {
                            discount = coupon.maxDiscountAmount;
                        }
                        couponDiscount = Math.round(discount);
                    } else {
                        couponDiscount = coupon.discountAmount;
                    }
                }
            }

            const finalTotal = Math.max(0, subtotal - couponDiscount);
            const coupons = await couponsModel.find({
                status: "Active",
                expiryDate: { $gte: new Date() },
                minPurchaseAmount: { $lte: subtotal }
            })

            return res.render("user/checkout", {
                title: "Checkout - Quavix",
                css: "userStyle",
                user,
                cart,
                subtotal,
                totalMRP,
                totalDiscount,
                couponDiscount,
                finalTotal,
                appliedCoupon,
                coupons,
                walletBalance,
                cancelUrl: "/cart"
            });
        }

        res.redirect("/cart");

    } catch (err) {
        res.redirect("/not-found");
    }
}

