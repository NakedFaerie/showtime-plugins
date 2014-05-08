/*
 *  www.shoutcast.com plugin for Showtime
 *
 *  Copyright (C) 2014 lprot
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


(function(plugin) {
    var BASE_URL = "http://www.shoutcast.com";
    var PREFIX = "shoutcast:";
    var logo = plugin.path + "logo.png";

    function setPageHeader(page, title) {
        page.loading = false;
        if (page.metadata) {
            page.metadata.title = title;
            page.metadata.logo = logo;
        }
        page.type = "directory";
        page.contents = "items";
    }

    const blue = "6699CC", orange = "FFA500";

    function colorStr(str, color) {
        return '<font color="' + color + '"> (' + str + ')</font>';
    }

    // create plugin favorites store
    var store = plugin.createStore('favorites', true)
    if (!store.list) {
        store.version = "1";
        store.background = "";
        store.title = "shoutcast » My Favorites";
        store.list = "[]";
    }

    // create plugin service
    plugin.createService("shoutcast", PREFIX + "start", "audio", true, logo);

    // create settings
    var settings = plugin.createSettings("shoutcast", logo, "SHOUTcast Radio - Listen to Free Online Radio Stations");

    settings.createAction("cleanFavorites", "Clean My Favorites", function() {
        store.list = "[]";
        showtime.notify('My Favorites are succesfully cleaned.', 2);
    });

    function trim(str) {
        return str.replace(/^\s+|\s+$/g,"");
    }

    function fill_fav(page) {
	var list = eval(store.list);

        if (!list || !list.toString()) {
           page.error("My Favorites list is empty");
           return;
        }

        var pos = 0;
	for each (item in list) {
	    var itemmd = showtime.JSONDecode(item);

	    var item = page.appendItem(itemmd.url, "station", {
		title: new showtime.RichText(itemmd.title),
		station: itemmd.station
	    });

            item.addOptAction("Remove '" + itemmd.station + "' from My Favorites", pos);

	    item.onEvent(pos, function(item) {
		var list = eval(store.list);
		showtime.notify(showtime.JSONDecode(list[item]).station + " has been removed from My Favorites.", 2);
	        list.splice(item, 1);
		store.list = showtime.JSONEncode(list);
                page.flush();
                fill_fav(page);
	    });
            pos++;
	}
    }

    // Favorites
    plugin.addURI(PREFIX + "favorites", function(page) {
        setPageHeader(page, "My Favorites");
        fill_fav(page);
    });

    plugin.addURI(PREFIX + "listStations:(.*):(.*)", function(page, title, category) {
        setPageHeader(page, 'Shoutcast - ' + unescape(unescape(title)));
        getStations(page, 'sub', '', category, '0');
    });

    plugin.addURI(PREFIX + "subcategory:(.*):(.*):(.*)", function(page, title, subcat_list, category) {
        setPageHeader(page, 'Shoutcast - ' + unescape(title));

        // 1-params, 2-title
        var re = /<a href="([\S\s]*?)">([\S\s]*?)<\/a>/g;
        var catlist = unescape(subcat_list);
        var match = re.exec(catlist);
        while (match) {
	    var item = page.appendItem(PREFIX + "listStations:"+escape(match[2]) + ":" + escape(match[1].match(/\&cat=(.*)\#/)[1]), "directory", {
		title: unescape(match[2])
	    });
            match = re.exec(catlist);
        };
        getStations(page, 'sub', '', category, '0');
    });

    plugin.addURI(PREFIX + "categories", function(page) {
        setPageHeader(page, 'Shoutcast - Categories');
        page.loading = true;
        var categories = showtime.httpReq(BASE_URL).toString();
        page.loading = false;

        // 1-params, 2-title, 3-submenu
        var re = /class="files"><a href="([\S\s]*?)">([\S\s]*?)<\/a>[\S\s]*?<ul class="sub-menu">([\S\s]*?)<\/ul>/g;
        var match = re.exec(categories);
        while (match) {
	    var item = page.appendItem(PREFIX + "subcategory:"+escape(match[2])+":"+escape(match[3])+":"+escape(match[1].match(/\&cat=(.*)\#/)[1]), "directory", {
		title: unescape(match[2])
	    });
            match = re.exec(categories);
        };
    });

    function getStations(page, action, string, cat, cf_rc) {
	var tryToSearch = true, fromPage = 1, itemsPerPage = 18;
        // 1-link, 2-title, 3-genre, 4-listeners, 5-bitrate, 6-format
        var re = /<a class="transition" href="([\S\s]*?)">([\S\s]*?)<\/a>[\S\s]*?<td width=[\S\s]*?>([\S\s]*?)<\/td>[\S\s]*?<td width=[\S\s]*?>([\S\s]*?)<\/td>[\S\s]*?<td width=[\S\s]*?>([\S\s]*?)<\/td>[\S\s]*?<td width=[\S\s]*?>([\S\s]*?)<\/td>/g;

        function loader() {
            if (!tryToSearch) return false;
                page.loading = true;
                var response = showtime.httpReq(BASE_URL + '/radiolist.cfm?action=' + action +
                    '&string=' + string + '&cat=' + cat + '&start=' + fromPage +
                    '&amount=' + itemsPerPage +
                    '&order=listeners&_cf_containerId=radiolist&_cf_nodebug=true&_cf_nocache=true&_cf_rc=' + cf_rc).toString();
                page.loading = false;
                var match = re.exec(response);
                while (match) {
	              var item = page.appendItem("icecast:"+match[1], "station", {
		          title: new showtime.RichText(unescape(match[2])+colorStr(match[3], orange)+
                              colorStr(match[4], orange)+colorStr(match[6]+' '+match[5], orange)),
		          station: unescape(match[2]),
		          description: match[3],
		          bitrate: match[5],
		          format: match[6],
		          listeners: match[4]
	              });
                      item.url = "icecast:"+match[1];
	              item.title = unescape(match[2]) + colorStr(match[3], orange)+
                              colorStr(match[6]+' '+match[5], orange);
		      item.station = unescape(match[2]);
	              item.onEvent("addFavorite", function(item) {
		          var entry = {
                               url: this.url,
		               title: this.title,
                               station: this.station
		          };
		          var list = eval(store.list);
                          var array = [showtime.JSONEncode(entry)].concat(list);
                          store.list = showtime.JSONEncode(array);
		          showtime.notify("'" + entry.station + "' has been added to My Favorites.", 2);
	              });
	              item.addOptAction("Add '" + unescape(match[2]) + "' to My Favorites", "addFavorite");
                      match = re.exec(response);
                      page.entries++;
                };
                if (response.match(/class="more transition">Start again<\/a>/) ||
                   !response.match(/class="more transition">/)) return tryToSearch = false;
                fromPage += itemsPerPage;
                return true;
        }
        loader();
        page.paginator = loader;
    };

    // Start page
    plugin.addURI(PREFIX + "start", function(page) {
        setPageHeader(page, "SHOUTcast Radio");
        page.loading = true;
        var categories = showtime.httpReq(BASE_URL).toString();
        page.loading = false;
        var info = categories.match(/<div class="infobox">[\S\s]*?<h3>([\S\s]*?)<\/h3>/);
        if (info) setPageHeader(page, "SHOUTcast Radio - " + info[1]);

     	page.appendItem(PREFIX + "categories", "directory", {
	    title: "Categories"
	});

	page.appendItem(PREFIX + "favorites", "directory", {
	    title: "My Favorites"
	});

        getStations(page, 'none', '', '', '0');
    });

    plugin.addSearcher("Shoutcast", logo, function(page, query) {
        page.entries = 0;
        getStations(page, 'search', escape(query), '', '0');
    });

})(this);
