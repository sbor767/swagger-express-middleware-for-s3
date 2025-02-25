"use strict";

module.exports = requestParser;

const _ = require("lodash");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const tmp = require("tmp");
const util = require("./helpers/util");

// Clean-up the temp directory, even if the app crashes
tmp.setGracefulCleanup();

/**
 * Parses the HTTP request into useful objects.
 * This middleware populates {@link Request#params}, {@link Request#headers}, {@link Request#cookies},
 * {@link Request#signedCookies}, {@link Request#query}, {@link Request#body}, and {@link Request#files}.
 *
 * @param   {requestParser.defaultOptions}  [options]
 * @returns {function[]}
 */
function requestParser (options) {
  // Override default options
  options = _.merge({}, requestParser.defaultOptions, options);

  /**
   * Parses multipart/form-data
   */
  function multipartFormData (req, res, next) {
    // The multipart can be set as a function to select the loading method for different routes
    const multipart = typeof options.multipart === "function" ? options.multipart(req) : options.multipart;
    // Create a Multer uploader
    const uploader = multer(multipart);

    if (util.isSwaggerRequest(req) && req.swagger.params.length > 0) {
      const fileFields = [];

      // Get all the "file" params
      req.swagger.params.forEach(param => {
        if (param.in === "formData" && param.type === "file") {
          fileFields.push({ name: param.name, maxCount: 1 });
        }
      });

      if (fileFields.length) {
        // Handle the multipart/form-data
        const upload = uploader.fields(fileFields);
        upload(req, res, err => {
          // Convert 'req.files' structure to required by 'parseParameter' one
          Object.keys(req.files).forEach(key => {
            req.files[key] = req.files[key].pop();
          });

          next(err);
        });
      }
      else {
        next();
      }
    }

    else {
      next();
    }
  }

  return [
    cookieParser(options.cookie.secret, options.cookie),
    bodyParser.json(options.json),
    bodyParser.text(options.text),
    bodyParser.urlencoded(options.urlencoded),
    bodyParser.raw(options.raw),
    multipartFormData
  ];

}

requestParser.defaultOptions = {
  /**
   * Cookie parser options
   * (see https://github.com/expressjs/cookie-parser#cookieparsersecret-options)
   */
  cookie: {
    secret: undefined
  },

  /**
   * JSON body parser options
   * (see https://github.com/expressjs/body-parser#bodyparserjsonoptions)
   */
  json: {
    limit: "1mb",
    type: ["json", "*/json", "+json"]
  },

  /**
   * Plain-text body parser options
   * (see https://github.com/expressjs/body-parser#bodyparsertextoptions)
   */
  text: {
    limit: "1mb",
    type: ["text/*"]
  },

  /**
   * URL-encoded body parser options
   * (see https://github.com/expressjs/body-parser#bodyparserurlencodedoptions)
   */
  urlencoded: {
    extended: true,
    limit: "1mb"
  },

  /**
   * Raw body parser options
   * (see https://github.com/expressjs/body-parser#bodyparserrawoptions)
   */
  raw: {
    limit: "5mb",
    type: "application/*"
  },

  /**
   * Multipart form data parser options
   * (see https://github.com/expressjs/multer#options)
   */
  multipart: {
    // By default, use the system's temp directory, and clean-up when the app exits
    dest: tmp.dirSync({ prefix: "swagger-express-middleware-", unsafeCleanup: true }).name,

    // the Swagger spec does not allow multiple file params with same name
    putSingleFilesInArray: false
  }
};
