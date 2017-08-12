const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    if (file.mimetype.startsWith('image/')) {
      next(null, true);
    } else {
      next({ message: 'That fileType isn\'t allowed' }, false);
    }
  },
};

exports.upload = multer(multerOptions).single('photo');
exports.resize = async (req, res, next) => {
  // check if there is no new file to resize
  if (!req.file) {
    return next(); // skip to the next middleware
  }
  const extension = req.file.mimetype.split('/')[1];
  req.body.photo = `${uuid.v4()}.${extension}`;
  // now we resize
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);
  // once we have written the photo to our file system, keep going
  next();
};

exports.homePage = (req, res) => res.render('index');

exports.addStore = (req, res) => res.render('editStore', { title: 'Add Store' });

exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  const store = await (new Store(req.body)).save();
  req.flash('success', `Successfully Created ${store.name}. Care to leave a review ?`);
  res.redirect(`/stores/${store.slug}`);
};

exports.getStores = async (req, res) => {
  const page = req.params.page || 1;
  const limit = 4;
  const skip = page * limit - limit;

  const storesPRomise = Store
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ created: 'desc' });

  const countPromise = Store.count();

  const [stores, count] = await Promise.all([storesPRomise, countPromise]);

  const pages = Math.ceil(count / limit);
  if (!stores.length && skip) {
    req.flash('info', `Hey ! You asked for page ${page}, but that doesn't exist. So I put you on page ${pages}`);
    res.redirect(`/stores/page/${pages}`);
    return;
  }
  res.render('stores', { title: 'Stores', stores, pages, page, count });
};

const confirmOwner = (store, user) => {
  if (!store.author.equals(user._id)) {
    throw Error('You must own a store in order to edit it');
  }
};
exports.editStore = async (req, res) => {
  // 1.Find the store given the ID
  const store = await Store.findOne({ _id: req.params.id });
  // 2.Confirm they are the owner of the store
  confirmOwner(store, req.user);
  // 3.Render out the edit form the user can update their store
  res.render('editStore', { title: `;Edit; $;{store.name; } `, store });
};

exports.updateStore = async (req, res) => {
  // Set the location data to be a point
  req.body.location.type = 'Point';
  // find and update the store
  const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true, // return new updated store instead of the old one
    runValidators: true,
  }).exec();
  // redirect to the store and tell that it worked
  req.flash('success', `;Successfully; updated < b > $;{store.name; }</b > . < a; href = '/stores/${store.slug}' > View; Store; ↪</a > `);
  res.redirect(` / stores / $; { store.id; } /edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
  const store = await Store.findOne({ slug: req.params.slug })
    .populate('author reviews'); // pour remplir le champs author avec l'auteur correspondant à _id
  if (!store) { return next(); }
  res.render('store', { store, title: store.name });
};

exports.getStoresByTag = async (req, res) => {
  const tag = req.params.tag;
  const tagQuery = tag || { $exists: true };
  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({ tags: tagQuery });
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
  res.render('tags', { tags, title: 'Tags', tag, stores });
};

exports.getHearts = async (req, res) => {
  const stores = await Store.find({
    _id: { $in: req.user.hearts },
  });
  res.render('stores', { title: 'Hearted Stores', stores });
};

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores();
  res.render('topStores', { stores, title: '⭐ Top Stores !' });
};

/*
    API
*/
exports.searchStores = async (req, res) => {
  const stores = await Store.find({
    // find stores that match
    $text: {
      $search: req.query.q,
    },
  }, {
      score: { $meta: 'textScore' },
    })
    // then sort them by score
    .sort({
      score: { $meta: 'textScore' },
    })
    // limit to only 5 result
    .limit(5);
  res.json(stores);
};

exports.mapStores = async (req, res) => {
  const coordinates = [+req.query.lng, +req.query.lat];
  const q = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates,
        },
        $maxDistance: 10000, // 10km
      },
    },
  };
  const stores = await Store.find(q).select('photo name slug description location photo').limit(10);
  res.json(stores);
};

exports.mapPage = (req, res) => res.render('map', { title: 'Map' });

exports.heartStore = async (req, res) => {
  const hearts = req.user.hearts.map(obj => obj.toString());
  const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
  const user = await User
    .findByIdAndUpdate(req.user.id,
    { [operator]: { hearts: req.params.id } },
    { new: true }
    );

  res.json(user);
};
