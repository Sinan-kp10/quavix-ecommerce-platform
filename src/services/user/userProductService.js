import productModel from "../../models/productModal.js"
import wishlistModel from "../../models/wishlistModel.js"
import cartModel from "../../models/cartModel.js"
import categoryModel from "../../models/category.js"




export const getFilterdProduct = async (
    categories,
    sort,
    minPrice,
    maxPrice,
    page = 1,
    limit = 6
) => {

    let query = { isDeleted: false };

    if (categories) {
        query.category = { $in: categories.split(",") };
    }

    const products = await productModel.find(query).populate("category");

    const getFinalPrice = (price, offer = 0) =>
        Math.round(price - (price * offer / 100));

    let variantList = [];
    products.forEach(product => {

        if (product.category?.status !== "Active") return;

        const offer = Math.max(product.offerPercentage || 0, product.category?.categoryOffer || 0);

        product.variants
            .filter(v => v.status === "Active")
            .forEach(variant => {

                const finalPrice = getFinalPrice(variant.price, offer);

                const minCheck = minPrice ? finalPrice >= Number(minPrice) : true;
                const maxCheck = maxPrice ? finalPrice <= Number(maxPrice) : true;

                if (minCheck && maxCheck) {
                    variantList.push({
                        ...product.toObject(),
                        variants: [variant],
                        finalPrice
                    });
                }

            });
    });

    if (sort) {

        variantList.sort((a, b) => {

            if (sort === "priceLow")
                return a.finalPrice - b.finalPrice;

            if (sort === "priceHigh")
                return b.finalPrice - a.finalPrice;

            if (sort === "nameAZ")
                return a.name.localeCompare(b.name);

            if (sort === "nameZA")
                return b.name.localeCompare(a.name);

            return 0;
        });
    }

    const totalItems = variantList.length;
    const totalPages = Math.ceil(totalItems / limit);

    const start = (page - 1) * limit;
    const paginated = variantList.slice(start, start + limit);

    return {
        products: paginated,
        totalPages
    };
};
export const findProducts = async (search) => {

    let query = { isDeleted: false };

    if (!search) {
        return await productModel.find(query);
    }

    const words = search.toLowerCase().split(" ");

    let nameFilter = [];
    let priceFilter = null;
    let attributeFilter = [];

    words.forEach(word => {
        if (word.includes("gb")) {
            attributeFilter.push(word);
        } else {
            nameFilter.push(word);
        }
    });

    let mongoQuery = { isDeleted: false };


    if (nameFilter.length > 0) {
        const regexPattern = nameFilter.join("|");
        const matchingCategories = await categoryModel.find({
            name: { $regex: regexPattern, $options: "i" }
        });
        const categoryIds = matchingCategories.map(c => c._id);

        if (categoryIds.length > 0) {
            mongoQuery.$or = [
                { name: { $regex: regexPattern, $options: "i" } },
                { category: { $in: categoryIds } }
            ];
        } else {
            mongoQuery.name = {
                $regex: regexPattern,
                $options: "i"
            };
        }
    }

    let products = await productModel.find(mongoQuery).populate("category");

    products = products.map(product => {

        if (product.category?.status !== "Active") return null;

        const matchedVariants = product.variants.filter(variant => {

            const priceMatch = priceFilter? variant.price <= priceFilter : true;

            const attributeMatch = attributeFilter.length > 0 ? variant.attributes.some(attr =>
                attributeFilter.some(filterValue =>
                attr.value.toLowerCase().replace(/\s+/g, "") === filterValue.replace(/\s+/g, ""))): true;

            return priceMatch && attributeMatch && variant.status === "Active";

        });

        return {...product.toObject(), variants: matchedVariants };

    }).filter(product => product && product.variants.length > 0);

    return {products , search};
}

export const addWishlistService = async (userId, productId, variantId) => {

    let wishlist = await wishlistModel.findOne({ user: userId });

    if (!wishlist) {
        wishlist = new wishlistModel({
            user: userId,
            items: [{ product: productId, variant: variantId }]
        });

        await wishlist.save();
        return { added: true,count: wishlist.items.length };
    }

    const existingIndex = wishlist.items.findIndex(item =>
        item.product.toString() === productId &&
        item.variant?.toString() === variantId
    )

    if (existingIndex > -1) {
        wishlist.items.splice(existingIndex, 1);
        await wishlist.save();
        return { added: false,count: wishlist.items.length };
    }

    wishlist.items.push({
        product: productId,
        variant: variantId
    });

    await wishlist.save();
    return { added: true,count: wishlist.items.length };
}

export const addToCartService = async (userId, productId, variantId) => {

    const product = await productModel.findById(productId).populate("category")
    if (!product || product.isDeleted || product.category?.status !== "Active") {
        throw new Error("This product is currently not available");
    }

    const variant = product.variants.find(v =>
        v._id.toString() === variantId.toString()
    );

    if (!variant) {
        throw new Error("Variant not found")
    }

    if (variant.stock <= 0) {
        throw new Error("Product is out of stock")
    }

    let cart = await cartModel.findOne({ user: userId })

    if (!cart) {
        cart = new cartModel({
            user: userId,
            items: []
        });
    }

    const existingItem = cart.items.find(item =>
        item.product.toString() === productId && item.variant.toString() === variantId
    );

    if (existingItem) {

        if (existingItem.quantity + 1 > variant.stock) {
            throw new Error(`Only ${variant.stock} items available in stock`);
        }

        existingItem.quantity += 1;
        

    } else {

        

        cart.items.push({
            product: productId,
            variant: variantId,
            quantity: 1
        });
    }

    
    
    await cart.save()

    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

export const removeFromCartService = async (userId, productId, variantId) => {

    const cart = await cartModel.findOne({ user: userId });
    if (!cart) return false;

    cart.items = cart.items.filter(item =>
        !(item.product.toString() === productId && item.variant.toString() === variantId)
    );

    await cart.save();

    return true;
}

export const updateCartQuantityService = async (userId,productId,variantId,changeType) =>{

    const cart = await cartModel.findOne({ user: userId });
    if(!cart) throw new Error("Cart not found");

    const item = cart.items.find(item => item.product.toString() === productId && item.variant.toString() === variantId)

    if(!item) throw new Error("Item not found")

    const product = await productModel.findById(productId);
    const variant = product.variants.find(v =>
        v._id.toString() === variantId
    )

    if(!variant) throw new Error("Variant not found");

    if(changeType === "inc"){

        if (item.quantity + 1 > variant.stock){
            throw new Error(`Only ${variant.stock} items available`)
        }

        item.quantity += 1

    }else if(changeType === "dec"){

        if(item.quantity > 1){
            item.quantity -= 1;
        }
    }

    await cart.save()

    return item.quantity
}

