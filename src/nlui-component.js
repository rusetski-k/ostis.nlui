NLUiComponent = {
    ext_lang: 'natural_language_ui',
    struct_support: true,
    formats: ['format_nl_json'],
    factory: function(sandbox) {
        return new NLViewer(sandbox);
    },
};

var NLViewer = function(sandbox) {
   
    var self = this;
    this.container = '#' + sandbox.container;
    this.sandbox = sandbox;
    
    this.defer_subject = null;
    
    // "подлежащее" в текущей конструкции
    this.subject = "";
    this.subj_node = 0;
    
    this.model = {};
    this.links = {};
       
    // ---- window interface -----
    this.receiveData = function(data) {
	        
    };
    
    /**
        Если subj и/или obj - числа, то считаем, что мы получили адрес sc-ссылки
    **/
    this._updateModel = function(arc, subj, act, obj, feat){
        if (this.model[arc]){
            if(subj){ 
                if ((typeof subj) === "number"){
                    this.model[arc][0] = "<span class='sc-content' id='nlui" + subj + "'/>"
                    this.links["nlui" + subj] = subj;
                }
                else{
                    this.model[arc][0] = subj;
                }
            }
            if(act)  this.model[arc][1] = act;
            if(obj){
                if ((typeof obj) === "number"){
                    this.model[arc][2] = "<span class='sc-content' id='nlui" + obj + "'/>"
                    this.links["nlui" + obj] = obj;
                }
                else{
                    this.model[arc][2] = obj;
                }
            }
            if(feat) this.model[arc][3] = feat;
        }
        else{
            var _subj = subj;
            var _obj = obj;
            
            if ((typeof subj) === "number"){
                _subj = "<span class='sc-content' id='nlui" + subj + "'/>"
                this.links["nlui" + subj] = subj;
            }
            
            if ((typeof obj) === "number"){
                _obj = "<span class='sc-content' id='nlui" + obj + "'/>"
                this.links["nlui" + obj] = obj;
            }

            this.model[arc] = [_subj, act, _obj, feat];
        }
        var updateMask = 0 | (subj ? 1:0) | (act ? 2:0) | (obj ? 4:0) | (feat ? 8:0);
        
        this.updateView(arc, updateMask);
    };
    
    this.updateView = function(arc, updateMask){
        var cont = $(this.container);
        var m = this.model;
        
        var id = "nlui" + arc;
        var selector = "#" + id;
        
        if(!$(selector).length){
            cont.append("<div id='" + id + "'><span class='subject'/> <span class='action'/> <span class='object'/> <span class='features'/></div>");
            $(selector).css("display", "none"); // блок нового предложения по умолчанию скрываем
        }
        
        if(updateMask & 1){
            $(selector).find(".subject").html(m[arc][0]);
        }
        if(updateMask & 2){ 
            $(selector).find(".action").html(m[arc][1]);
        }
        if(updateMask & 4){
            $(selector).find(".object").html(m[arc][2]);
        }
        if(updateMask & 8){
            $(selector).find(".features").html(m[arc][3]);
        }
        
        // если у нас уже появилась тройка SAO, отображаем блок предложения
        // TODO улучшить условие
        if (!((!m[arc][0]) | (!m[arc][1]) | (!m[arc][2]))){
            $(selector).css("display", "block");
        }      

        this.sandbox.createViewersForScLinks(this.links);
        this.links = {};
    };
    
    this.updateStruct = function(added, elem, arc) {
        var sandbox = this.sandbox;
        var cont = $(this.container);

        if (!this.defer_subject){
            //find a question node
            this.defer_subject = window.sctpClient.iterate_elements(SctpIteratorType.SCTP_ITERATOR_5A_A_F_A_F, 
            [
            sc_type_node, 
            sc_type_arc_common|sc_type_const, 
            elem, 
            sc_type_arc_pos_const_perm, 
            window.scKeynodes.nrel_answer
            ])
            .done(function(el){
                //find question argument
                var _q = el[0][0];
                window.sctpClient.iterate_elements(SctpIteratorType.SCTP_ITERATOR_3F_A_A,
                [
                _q,
                sc_type_arc_pos_const_perm,
                sc_type_node
                ])
                .done(function(el){
                    self.subj_node = el[0][2];
                    sandbox.getIdentifier(self.subj_node, function(id){
                        self.subject = id;
                        //self.updateView();
                    });
                });
            });
        }

        
        window.sctpClient.get_arc(arc).done(function(a){
            var elem = a[1];   
            window.sctpClient.get_element_type(elem).done(function(t){
                if (t & sc_type_arc_access){
                    window.sctpClient.get_arc(elem).done(function(a2){
                        var beg = a2[0];
                        var end = a2[1];
                        var predicate = "принадлежит множеству";
                                                
                        if (self.subj_node == beg){
                            sandbox.getIdentifier(end, function(id){
                                if(id){
                                    self._updateModel(elem, id, predicate, self.subject, null);
                                }    
                                else{
                                    window.sctpClient.get_element_type(end).done(function(t){
                                        if (t & sc_type_link){ // sc-ссылка
                                            self._updateModel(elem, end, predicate, self.subject, null);
                                        }
                                        else if (t & sc_type_node){ // безымянный узел
                                            self._updateModel(elem, "&lt;без имени&gt;", predicate, self.subject, null);  
                                        }
                                    });
                                }
                            });
                        }
                        else if (self.subj_node == end){
                            sandbox.getIdentifier(beg, function(id){
                                if(id){
                                    self._updateModel(elem, self.subject, predicate, id, null);
                                }
                                else{
                                    window.sctpClient.get_element_type(end).done(function(t){
                                        if (t & sc_type_link){ // sc-ссылка
                                            self._updateModel(elem, self.subject, predicate, end);
                                        }
                                        else if (t & sc_type_node){ // безымянный узел
                                            self._updateModel(elem, self.subject, predicate, "&lt;без имени&gt;", null); 
                                        }
                                    });        
                                }
                                
                            });
                        }
                        else{
                            window.sctpClient.get_element_type(end).done(function(t){
                                if (t & sc_type_arc_access){
                                    sandbox.getIdentifier(beg, function(id){
                                        self._updateModel(end, null, null, null, "в роли " + id);
                                    });
                                }
                                else if (t & sc_type_arc_common){
                                    sandbox.getIdentifier(beg, function(id){
                                        self._updateModel(end, null, null, null, "отношением " + id);
                                    });
                                }
                            });
                        }
                    });
                }
                else if (t & sc_type_arc_common){
                    window.sctpClient.get_arc(elem).done(function(a2){
                        var beg = a2[0];
                        var end = a2[1];
                        var predicate = "связан c";
                        
                        if (self.subj_node == beg){
                            sandbox.getIdentifier(end, function(id){
                                if(id){
                                    self._updateModel(elem, self.subject, predicate, id, null);
                                }
                                else{
                                    window.sctpClient.get_element_type(end).done(function(t){
                                        if (t & sc_type_link){
                                            self._updateModel(elem, self.subject, predicate, end, null);
                                        }
                                        else if (t & sc_type_node){    
                                            self._updateModel(elem, self.subject, predicate, "&lt;без имени&gt;", null);
                                       }
                                    });    
                                }
                            });
                        }
                        else if (self.subj_node == end){
                            sandbox.getIdentifier(beg, function(id){ 
                                if(id){ // узел имеет идентификатор
                                    self._updateModel(elem, id, predicate, self.subject, null);
                                }
                                else { // узел не имеет идентификатора - возможно, это sc-ссылка
                                    window.sctpClient.get_element_type(beg).done(function(t){
                                        if (t & sc_type_link){
                                            self._updateModel(elem, end, predicate, self.subject, null);
                                        }
                                        else if (t & sc_type_node){ // безымянный узел без содержимого
                                            self._updateModel(elem, "&lt;без имени&gt;", predicate, self.subject, null);
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        });
    };
    
    this.sandbox.eventDataAppend = $.proxy(this.receiveData, this);
    this.sandbox.eventStructUpdate = $.proxy(this.updateStruct, this);
    
    this.sandbox.updateContent();
};

SCWeb.core.ComponentManager.appendComponentInitialize(NLUiComponent);
