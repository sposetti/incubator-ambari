/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var App = require('app');

App.MainAdminClusterController = Em.Controller.extend({
  name:'mainAdminClusterController',
  services: [],
  upgradeVersion: '',
  /**
   * get the newest version of HDP from server
   */
  updateUpgradeVersion: function(){
    if(App.router.get('clusterController.isLoaded')){
      var url = App.formatUrl(
        App.apiPrefix + "/stacks2/HDP/versions?fields=stackServices/StackServices,Versions",
        {},
        '/data/wizard/stack/stacks.json'
      );
      var upgradeVersion = this.get('upgradeVersion') || App.defaultStackVersion;
      var currentStack = {};
      var upgradeStack = {};
      $.ajax({
        type: "GET",
        url: url,
        async: false,
        dataType: 'json',
        timeout: App.timeout,
        success: function (data) {
          var currentVersion = App.currentStackVersion.replace(/HDP-/, '');
          var minUpgradeVersion = currentVersion;
          upgradeVersion = upgradeVersion.replace(/HDP-/, '');
          data.items.mapProperty('Versions.stack_version').forEach(function(version){
            upgradeVersion = (upgradeVersion < version) ? version : upgradeVersion;
          });
          currentStack = data.items.findProperty('Versions.stack_version', currentVersion);
          upgradeStack = data.items.findProperty('Versions.stack_version', upgradeVersion);
          minUpgradeVersion = upgradeStack.Versions.min_upgrade_version;
          if(minUpgradeVersion && (minUpgradeVersion > currentVersion)){
            upgradeVersion = currentVersion;
            upgradeStack = currentStack;
          }
          upgradeVersion = 'HDP-' + upgradeVersion;
        },
        error: function (request, ajaxOptions, error) {
          console.log('Error message is: ' + request.responseText);
        },
        statusCode: require('data/statusCodes')
      });
      this.set('upgradeVersion', upgradeVersion);
      if(currentStack && upgradeStack){
        this.parseServicesInfo(currentStack, upgradeStack);
      } else {
        console.log('HDP stack doesn\'t have services with defaultStackVersion');
      }
    }
  }.observes('App.router.clusterController.isLoaded', 'App.currentStackVersion'),
  /**
   * parse services info(versions, description) by version
   */
  parseServicesInfo: function (currentStack, upgradeStack) {
    var result = [];
    var installedServices = App.Service.find().mapProperty('serviceName');
    var displayOrderConfig = require('data/services');
    if(currentStack.stackServices.length && upgradeStack.stackServices.length){
      // loop through all the service components
      for (var i = 0; i < displayOrderConfig.length; i++) {
        var entry = currentStack.stackServices.
          findProperty("StackServices.service_name", displayOrderConfig[i].serviceName);
        if (entry) {
          entry = entry.StackServices;
        if (installedServices.contains(entry.service_name)) {
          var myService = Em.Object.create({
            serviceName: entry.service_name,
            displayName: displayOrderConfig[i].displayName,
            isDisabled: i === 0,
            isSelected: true,
            isInstalled: false,
            isHidden: displayOrderConfig[i].isHidden,
            description: entry.comments,
            version: entry.service_version,
            newVersion: upgradeStack.stackServices.
              findProperty("StackServices.service_name", displayOrderConfig[i].serviceName).
              StackServices.service_version
          });
          //From 1.3.0 for Hive we display only "Hive" (but it install HCat and WebHCat as well)
          if (this.get('upgradeVersion').replace(/HDP-/, '') >= '1.3.0' && displayOrderConfig[i].serviceName == 'HIVE') {
            myService.set('displayName', 'Hive');
          }
          result.push(myService);
          }
        }
        else {
          console.warn('Service not found - ', displayOrderConfig[i].serviceName);
        }
      }
    }
    this.set('services', result);
  }
});