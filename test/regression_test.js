/*!
 * Copyright (c) 2015, Salesforce.com, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of Salesforce.com nor the names of its contributors may
 * be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

"use strict";
const vows = require("vows");
const assert = require("assert");
const async = require("async");
const tough = require("../lib/cookie");
const Cookie = tough.Cookie;
const CookieJar = tough.CookieJar;
const MemoryCookieStore = tough.MemoryCookieStore;

const atNow = Date.now();

function at(offset) {
  return { now: new Date(atNow + offset) };
}

vows
  .describe("Regression tests")
  .addBatch({
    "Issue 1": {
      topic: function() {
        const cj = new CookieJar();
        cj.setCookie(
          "hello=world; path=/some/path/",
          "http://domain/some/path/file",
          (err, cookie) => {
            this.callback(err, { cj: cj, cookie: cookie });
          }
        );
      },
      "stored a cookie": function(t) {
        assert.ok(t.cookie);
      },
      "getting it back": {
        topic: function(t) {
          t.cj.getCookies("http://domain/some/path/file", (err, cookies) => {
            this.callback(err, { cj: t.cj, cookies: cookies || [] });
          });
        },
        "got one cookie": function(t) {
          assert.lengthOf(t.cookies, 1);
        },
        "it's the right one": function(t) {
          const c = t.cookies[0];
          assert.equal(c.key, "hello");
          assert.equal(c.value, "world");
        }
      }
    }
  })
  .addBatch({
    "trailing semi-colon set into cj": {
      topic: function() {
        const cb = this.callback;
        const cj = new CookieJar();
        const ex = "http://www.example.com";
        const tasks = [];
        tasks.push(next => {
          cj.setCookie("broken_path=testme; path=/;", ex, at(-1), next);
        });
        tasks.push(next => {
          cj.setCookie("b=2; Path=/;;;;", ex, at(-1), next);
        });
        async.parallel(tasks, (err, cookies) => {
          cb(null, {
            cj: cj,
            cookies: cookies
          });
        });
      },
      "check number of cookies": function(t) {
        assert.lengthOf(t.cookies, 2, "didn't set");
      },
      "check *broken_path* was set properly": function(t) {
        assert.equal(t.cookies[0].key, "broken_path");
        assert.equal(t.cookies[0].value, "testme");
        assert.equal(t.cookies[0].path, "/");
      },
      "check *b* was set properly": function(t) {
        assert.equal(t.cookies[1].key, "b");
        assert.equal(t.cookies[1].value, "2");
        assert.equal(t.cookies[1].path, "/");
      },
      "retrieve the cookie": {
        topic: function(t) {
          const cb = this.callback;
          t.cj.getCookies("http://www.example.com", {}, (err, cookies) => {
            t.cookies = cookies;
            cb(err, t);
          });
        },
        "get the cookie": function(t) {
          assert.lengthOf(t.cookies, 2);
          assert.equal(t.cookies[0].key, "broken_path");
          assert.equal(t.cookies[0].value, "testme");
          assert.equal(t.cookies[1].key, "b");
          assert.equal(t.cookies[1].value, "2");
          assert.equal(t.cookies[1].path, "/");
        }
      }
    }
  })
  .addBatch({
    "tough-cookie throws exception on malformed URI (GH-32)": {
      topic: function() {
        const url = "http://www.example.com/?test=100%";
        const cj = new CookieJar();

        cj.setCookieSync("Test=Test", url);

        return cj.getCookieStringSync(url);
      },
      "cookies are set": function(cookieStr) {
        assert.strictEqual(cookieStr, "Test=Test");
      }
    }
  })
  .addBatch({
    "setCookie (without options) callback works even if it's not instanceof Function (GH-158/GH-175)": {
      topic: function() {
        const cj = new CookieJar();

        const thisCallback = this.callback;
        const cb = function(err, cookie) {
          thisCallback(err, cookie);
        };
        Object.setPrototypeOf(cb, null);
        assert(
          !(cb instanceof Function),
          "clearing callback prototype chain failed"
        );

        cj.setCookie("a=b", "http://example.com/index.html", cb);
      },
      works: function(c) {
        assert.instanceOf(c, Cookie);
      }
    },
    "getCookies (without options) callback works even if it's not instanceof Function (GH-175)": {
      topic: function() {
        const cj = new CookieJar();
        const url = "http://example.com/index.html";
        cj.setCookieSync("a=b", url);

        const thisCallback = this.callback;
        const cb = function(err, cookies) {
          thisCallback(err, cookies);
        };
        Object.setPrototypeOf(cb, null);
        assert(
          !(cb instanceof Function),
          "clearing callback prototype chain failed"
        );

        cj.getCookies(url, cb);
      },
      works: function(cookies) {
        assert.lengthOf(cookies, 1);
      }
    }
  })
  .addBatch(
    {
      "setCookie with localhost (GH-215)": {
        topic: function() {
          const cookieJar = new CookieJar();
          return cookieJar.setCookieSync(
            "a=b; Domain=localhost",
            "http://localhost"
          ); // when domain set to 'localhost', will throw 'Error: Cookie has domain set to a public suffix'
        },
        works: function(err, c) {
          // localhost as domain throws an error, cookie should not be defined
          assert.instanceOf(err, Error);
          assert.isUndefined(c);
        }
      }
    },
    {
      "setCookie with localhost (GH-215) (null domain)": {
        topic: function() {
          const cookieJar = new CookieJar();
          return cookieJar.setCookieSync("a=b; Domain=", "http://localhost"); // when domain set to 'localhost', will throw 'Error: Cookie has domain set to a public suffix'
        },
        works: function(c) {
          assert.instanceOf(c, Cookie);
        }
      }
    },
    {
      "setCookie with localhost (localhost.local domain) (GH-215)": {
        topic: function() {
          const cookieJar = new CookieJar();
          return cookieJar.setCookieSync(
            "a=b; Domain=localhost.local",
            "http://localhost"
          );
        },
        works: function(c) {
          assert.instanceOf(c, Cookie);
        }
      }
    },
    {
      "setCookie with localhost (.localhost domain), (GH-215)": {
        topic: function() {
          const cookieJar = new CookieJar();
          return cookieJar.setCookieSync(
            "a=b; Domain=.localhost",
            "http://localhost"
          );
        },
        works: function(c) {
          assert.instanceOf(c, Cookie);
        }
      }
    }
  )
  .addBatch({
    MemoryCookieStore: {
      topic: new MemoryCookieStore(),
      "has no static methods": function() {
        assert.deepEqual(Object.keys(MemoryCookieStore), []);
      },
      "has instance methods that return promises": function(store) {
        assert.instanceOf(store.findCookie("example.com", "/", "key"), Promise);
        assert.instanceOf(store.findCookies("example.com", "/"), Promise);
        assert.instanceOf(store.putCookie({}), Promise);
        assert.instanceOf(store.updateCookie({}, {}), Promise);
        assert.instanceOf(
          store.removeCookie("example.com", "/", "key"),
          Promise
        );
        assert.instanceOf(store.removeCookies("example.com", "/"), Promise);
        assert.instanceOf(store.removeAllCookies(), Promise);
        assert.instanceOf(store.getAllCookies(), Promise);
      }
    }
  })
  .export(module);
